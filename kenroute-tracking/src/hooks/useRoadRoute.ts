import { useEffect, useRef, useState } from "react";
import type { LocationFix, StopInfo } from "../types/tracking";

export interface RoadRoute {
  /** The road from the bus to the stop, as [latitude, longitude] points. */
  line: [number, number][];
  km: number;
  minutes: number;
}

/** Ask again only once the bus has moved this far, or this much time has passed. */
const MOVED_KM = 0.3;
const EVERY_MS = 60_000;

function apartKm(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const h =
    Math.sin(rad(b.latitude - a.latitude) / 2) ** 2 +
    Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(rad(b.longitude - a.longitude) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

/**
 * The road between the bus and the passenger's stop, with its length and driving time.
 * Null until known, or when the route service cannot be reached; the map then draws a
 * straight line and the server's rougher estimate is shown instead.
 *
 * ponytail: uses the free public OSRM demo server, which has no uptime promise and is
 * meant for light use. Before real passengers rely on this, run our own OSRM or pay a
 * routing provider, and change ROUTER.
 */
const ROUTER = "https://router.project-osrm.org/route/v1/driving";

export function useRoadRoute(location: LocationFix | null, stop: StopInfo | null): RoadRoute | null {
  const [route, setRoute] = useState<RoadRoute | null>(null);
  const last = useRef<{ at: number; latitude: number; longitude: number; stop: string } | null>(null);

  useEffect(() => {
    if (!location || !stop) {
      last.current = null;
      setRoute(null);
      return;
    }
    const stopKey = `${stop.latitude},${stop.longitude}`;
    const prev = last.current;
    if (prev && prev.stop === stopKey && Date.now() - prev.at < EVERY_MS && apartKm(prev, location) < MOVED_KM) return;
    last.current = { at: Date.now(), latitude: location.latitude, longitude: location.longitude, stop: stopKey };

    const url = `${ROUTER}/${location.longitude},${location.latitude};${stop.longitude},${stop.latitude}?overview=full&geometries=geojson`;
    let cancelled = false;
    fetch(url, { signal: AbortSignal.timeout(8000) })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { routes?: { distance: number; duration: number; geometry: { coordinates: [number, number][] } }[] } | null) => {
        const found = data?.routes?.[0];
        if (cancelled || !found) return;
        setRoute({
          line: found.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
          km: Math.round(found.distance / 100) / 10,
          minutes: Math.max(1, Math.round(found.duration / 60)),
        });
      })
      .catch(() => {}); // keep the last road we had
    return () => {
      cancelled = true;
    };
  }, [location, stop]);

  return route;
}
