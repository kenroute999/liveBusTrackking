// Smoothly moving the bus between real GPS fixes. No data is invented: the bus eases
// from the previous fix to the next one using requestAnimationFrame and a fixed travel
// duration. Rotation uses the GPS heading when the phone reports one, otherwise the
// bearing from the previous fix to the current one.

import type { LocationFix } from "../types/tracking";

/** Seconds the bus takes to glide from one fix to the next. */
const TRAVEL_MS = 2600;
/** Movement longer than this between fixes (metres) is treated as a jump, not a glide. */
const MAX_GLIDE_M = 400;

const EARTH_R = 6_371_000;

/** Great-circle distance in metres between two lat/lng pairs. */
export function distanceM(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const toRad = Math.PI / 180;
  const dLat = (bLat - aLat) * toRad;
  const dLng = (bLng - aLng) * toRad;
  const s =
    Math.sin(dLat / 2) ** 2 + Math.cos(aLat * toRad) * Math.cos(bLat * toRad) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_R * Math.asin(Math.min(1, Math.sqrt(s)));
}

/** Initial bearing in degrees (0 = north, clockwise) from one point to another. */
export function bearingDeg(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const toRad = Math.PI / 180;
  const dLng = (bLng - aLng) * toRad;
  const y = Math.sin(dLng) * Math.cos(bLat * toRad);
  const x =
    Math.cos(aLat * toRad) * Math.sin(bLat * toRad) -
    Math.sin(aLat * toRad) * Math.cos(bLat * toRad) * Math.cos(dLng);
  return (Math.atan2(y, x) / toRad + 360) % 360;
}

/** Interpolate from a -> b by t in [0,1] in lat/lng space (fine over a single hop). */
function lerpLatLng(aLat: number, aLng: number, bLat: number, bLng: number, t: number): [number, number] {
  return [aLat + (bLat - aLat) * t, aLng + (bLng - aLng) * t];
}

/** Shortest signed angular difference from a -> b, in degrees. */
export function shortestDelta(a: number, b: number): number {
  return ((((b - a) % 360) + 540) % 360) - 180;
}

/**
 * Plays one hop: eases the marker from the previous fix to the next over TRAVEL_MS,
 * turning to face the travel direction. Returns a cancel function.
 */
export function glideBus(
  prev: LocationFix,
  next: LocationFix,
  onFrame: (pos: [number, number], headingDeg: number) => void,
  onDone: (pos: [number, number], headingDeg: number) => void,
): () => void {
  const start: [number, number] = [prev.latitude, prev.longitude];
  const end: [number, number] = [next.latitude, next.longitude];
  const metres = distanceM(start[0], start[1], end[0], end[1]);

  // Desired facing: the GPS heading if present, else the direction of travel.
  const targetHeading =
    typeof next.heading === "number" && !Number.isNaN(next.heading)
      ? next.heading
      : bearingDeg(start[0], start[1], end[0], end[1]);

  const prevHeading =
    typeof prev.heading === "number" && !Number.isNaN(prev.heading) ? prev.heading : targetHeading;
  const headingDelta = shortestDelta(prevHeading, targetHeading);

  // A large jump (teleport, bad fix) is not glided; it snaps to the new position.
  if (metres > MAX_GLIDE_M) {
    onDone(end, targetHeading);
    return () => {};
  }

  const started = performance.now();
  let raf = 0;
  const ease = (t: number) => t * t * (3 - 2 * t); // smoothstep

  const step = (now: number) => {
    const t = Math.min(1, (now - started) / TRAVEL_MS);
    const e = ease(t);
    const pos = lerpLatLng(start[0], start[1], end[0], end[1], e);
    const heading = prevHeading + headingDelta * e;
    onFrame(pos, heading);
    if (t < 1) raf = requestAnimationFrame(step);
    else onDone(pos, heading);
  };
  raf = requestAnimationFrame(step);

  return () => cancelAnimationFrame(raf);
}

/** True when the fix is old enough that the bus should be shown, not glided. */
export function isJump(prev: LocationFix | null, next: LocationFix): boolean {
  if (!prev) return true;
  return distanceM(prev.latitude, prev.longitude, next.latitude, next.longitude) > MAX_GLIDE_M;
}