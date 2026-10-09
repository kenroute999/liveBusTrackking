import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, fetchCurrentLocation, lookupByMobile, lookupByPnr } from "../services/trackingApi";
import type { LocationFix, StopInfo, TripInfo, TrackingPhase } from "../types/tracking";

/** The phone aims for a position every 15 seconds, but a real phone (indoors, saving battery)
 * often leaves gaps of a minute or two; only 3 minutes of silence counts as stale. */
const STALE_MS = 180_000;
/** How often the page asks the server where the bus is. */
const POLL_MS = 10_000;

interface LiveState {
  phase: TrackingPhase;
  trip: TripInfo | null;
  location: LocationFix | null;
  stop: StopInfo | null;
  errorMessage: string | null;
  /** False while the server cannot be reached. */
  connected: boolean;
}

const initial: LiveState = { phase: "SEARCH", trip: null, location: null, stop: null, errorMessage: null, connected: true };

function derivePhase(trip: TripInfo | null, location: LocationFix | null): TrackingPhase {
  if (!trip) return "NOT_FOUND";
  if (trip.status === "COMPLETED" || trip.status === "CANCELLED") return "COMPLETED";
  if (!location) return "NOT_STARTED";
  const age = Date.now() - new Date(location.recordedAt).getTime();
  return age > STALE_MS ? "STALE" : "LIVE";
}

function mapSearchError(err: unknown): TrackingPhase {
  if (err instanceof ApiError && (err.status === 404 || err.status === 400)) return "NOT_FOUND";
  return "NETWORK_ERROR";
}

export function useLiveTracking(initialToken?: string | null) {
  const [state, setState] = useState<LiveState>(initial);
  const poll = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = () => {
    if (poll.current) clearInterval(poll.current);
    poll.current = null;
  };

  const start = useCallback(async (token: string) => {
    stopPolling();
    setState((s) => ({ ...s, phase: "LOADING", errorMessage: null }));
    const refresh = async () => {
      const res = await fetchCurrentLocation(token);
      setState((s) => ({ ...s, trip: res.trip, location: res.location, stop: res.stop ?? null, phase: derivePhase(res.trip, res.location), connected: true }));
    };
    try {
      await refresh();
      history.replaceState(null, "", `/t/${token}`);
      // ponytail: asks every 10 seconds. Switch to a pushed channel (Socket.IO) if buses
      // must glide in real time or thousands of passengers watch at once.
      poll.current = setInterval(() => {
        refresh().catch((err) => {
          if (err instanceof ApiError && err.status === 401) {
            stopPolling();
            setState((s) => ({ ...s, phase: "EXPIRED" }));
          } else {
            // Keep the last known position on screen; it turns stale by its own age.
            setState((s) => ({ ...s, connected: false, phase: derivePhase(s.trip, s.location) }));
          }
        });
      }, POLL_MS);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setState((s) => ({ ...s, phase: "EXPIRED" }));
      } else {
        setState((s) => ({ ...s, phase: "NETWORK_ERROR", errorMessage: err instanceof Error ? err.message : String(err) }));
      }
    }
  }, []);

  const searchPnr = useCallback(
    async (pnr: string) => {
      setState((s) => ({ ...s, phase: "LOADING", errorMessage: null }));
      try {
        const res = await lookupByPnr(pnr);
        await start(res.token);
      } catch (err) {
        setState((s) => ({ ...s, phase: mapSearchError(err), errorMessage: err instanceof Error ? err.message : null }));
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
        setState((s) => ({ ...s, phase: mapSearchError(err), errorMessage: err instanceof Error ? err.message : null }));
      }
    },
    [start],
  );

  const reset = useCallback(() => {
    stopPolling();
    history.replaceState(null, "", "/");
    setState(initial);
  }, []);

  useEffect(() => {
    if (initialToken) void start(initialToken);
    return stopPolling;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { ...state, searchPnr, searchMobile, start, reset };
}
