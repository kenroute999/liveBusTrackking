import { useCallback, useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import { ApiError, fetchCurrentLocation, lookupByMobile, lookupByPnr } from "../services/trackingApi";
import { connectTrackingSocket } from "../services/socket";
import type { LocationFix, TripInfo, TrackingPhase } from "../types/tracking";

/** Conductor GPS fixes stream in roughly every few seconds; 90s with no fix = stale. */
const STALE_MS = 90_000;

interface LiveState {
  phase: TrackingPhase;
  trip: TripInfo | null;
  location: LocationFix | null;
  errorMessage: string | null;
  socketConnected: boolean;
}

const initial: LiveState = { phase: "SEARCH", trip: null, location: null, errorMessage: null, socketConnected: false };

function derivePhase(trip: TripInfo | null, location: LocationFix | null): TrackingPhase {
  if (!trip) return "NOT_FOUND";
  if (trip.status === "COMPLETED" || trip.status === "CANCELLED") return "COMPLETED";
  if (!location) return trip.status === "IN_PROGRESS" || trip.status === "BOARDING" ? "STALE" : "NOT_STARTED";
  const age = Date.now() - new Date(location.recordedAt).getTime();
  return age > STALE_MS ? "STALE" : "LIVE";
}

function mapSearchError(err: unknown): TrackingPhase {
  if (err instanceof ApiError) {
    if (err.status === 404) return "NOT_FOUND";
    if (err.status === 429) return "NETWORK_ERROR";
    if (err.code === "NETWORK_ERROR") return "NETWORK_ERROR";
    if (err.status === 400) return "NOT_FOUND";
  }
  return "NETWORK_ERROR";
}

export function useLiveTracking(initialToken?: string | null) {
  const [state, setState] = useState<LiveState>(initial);
  const socketRef = useRef<Socket | null>(null);
  const watchdog = useRef<ReturnType<typeof setInterval> | null>(null);
  const tripRef = useRef<TripInfo | null>(null);
  const locRef = useRef<LocationFix | null>(null);
  tripRef.current = state.trip;
  locRef.current = state.location;

  const clearWatchdog = () => {
    if (watchdog.current) clearInterval(watchdog.current);
    watchdog.current = null;
  };

  const armWatchdog = useCallback(() => {
    clearWatchdog();
    watchdog.current = setInterval(() => {
      setState((s) => ({ ...s, phase: derivePhase(tripRef.current ?? s.trip, locRef.current ?? s.location) }));
    }, 5000);
  }, []);

  const connectSocket = useCallback((nextToken: string): void => {
    socketRef.current?.disconnect();
    const socket = connectTrackingSocket(nextToken);
    socketRef.current = socket;

    socket.on("connect", () => {
      setState((s) => ({ ...s, socketConnected: true }));
      // Resync over HTTP on every (re)connect: the socket may have missed fixes.
      void fetchCurrentLocation(nextToken)
        .then((res) => setState((s) => ({ ...s, trip: res.trip, location: res.location, phase: derivePhase(res.trip, res.location) })))
        .catch(() => {});
    });

    socket.on("connect_error", (err) => {
      if (err.message === "UNAUTHENTICATED") {
        setState((s) => ({ ...s, phase: "EXPIRED", socketConnected: false }));
      } else {
        setState((s) => ({ ...s, socketConnected: false }));
      }
    });
    socket.on("disconnect", () => setState((s) => ({ ...s, socketConnected: false })));
    socket.on("location", (fix: LocationFix) => {
      setState((s) => ({ ...s, location: fix, phase: derivePhase(s.trip, fix) }));
    });
  }, []);

  const start = useCallback(
    async (nextToken: string) => {
      setState((s) => ({ ...s, phase: "LOADING", errorMessage: null }));
      try {
        const res = await fetchCurrentLocation(nextToken);
        setState((s) => ({ ...s, trip: res.trip, location: res.location, phase: derivePhase(res.trip, res.location) }));
        connectSocket(nextToken);
        history.replaceState(null, "", `/t/${nextToken}`);
        armWatchdog();
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          setState((s) => ({ ...s, phase: "EXPIRED" }));
        } else {
          setState((s) => ({ ...s, phase: "NETWORK_ERROR", errorMessage: err instanceof Error ? err.message : String(err) }));
        }
      }
    },
    [connectSocket, armWatchdog],
  );

  const searchPnr = useCallback(
    async (pnr: string) => {
      setState((s) => ({ ...s, phase: "LOADING", errorMessage: null }));
      try {
        const res = await lookupByPnr(pnr);
        await start(res.token);
      } catch (err) {
        setState((s) => ({ ...s, phase: mapSearchError(err) }));
      }
    },
    [start],
  );

  const searchMobile = useCallback(
    async (mobile: string) => {
      setState((s) => ({ ...s, phase: "LOADING", errorMessage: null }));
      try {
        const res = await lookupByMobile(mobile);
        await start(res.token);
      } catch (err) {
        setState((s) => ({ ...s, phase: mapSearchError(err) }));
      }
    },
    [start],
  );

  const reset = useCallback(() => {
    clearWatchdog();
    socketRef.current?.disconnect();
    socketRef.current = null;
    history.replaceState(null, "", "/");
    setState(initial);
  }, []);

  useEffect(() => {
    if (initialToken) void start(initialToken);
    return () => {
      clearWatchdog();
      socketRef.current?.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { ...state, searchPnr, searchMobile, start, reset };
}
