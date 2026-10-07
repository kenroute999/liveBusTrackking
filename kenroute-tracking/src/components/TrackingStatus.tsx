import { useEffect, useState } from "react";
import type { LocationFix, StopInfo, TrackingPhase } from "../types/tracking";

interface Props {
  phase: TrackingPhase;
  location: LocationFix | null;
  stop: StopInfo | null;
  connected: boolean;
}

function etaLabel(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} hr` : `${hours} hr ${rest} min`;
}

function ageLabel(recordedAt: string | undefined): string {
  if (!recordedAt) return "";
  const secs = Math.max(0, Math.round((Date.now() - new Date(recordedAt).getTime()) / 1000));
  if (secs < 60) return `${secs} second${secs === 1 ? "" : "s"} ago`;
  const mins = Math.round(secs / 60);
  return `${mins} minute${mins === 1 ? "" : "s"} ago`;
}

export function TrackingStatus({ phase, location, stop, connected }: Props) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const speedKmh = typeof location?.speed === "number" ? Math.round(location.speed * 3.6) : null;

  return (
    <div className="status-bar">
      {stop && (
        <div className="eta">
          <span className="eta-label">{stop.kind === "BOARDING" ? "Your boarding point" : "Your dropping point"}</span>
          <strong>{stop.name}</strong>
          {phase === "LIVE" && stop.etaMinutes !== null && stop.distanceKm !== null && (
            <span className="eta-time">
              Bus is about <b>{etaLabel(stop.etaMinutes)}</b> away ({stop.distanceKm} km)
            </span>
          )}
        </div>
      )}
      {phase === "LIVE" && (
        <>
          {speedKmh !== null && <span className="stat">Speed: {speedKmh} km/h</span>}
          {location && <span className="stat">Last updated: {ageLabel(location.recordedAt)}</span>}
        </>
      )}
      {phase === "STALE" && (
        <div className="banner warn">
          🟠 Location temporarily unavailable — we haven't received a recent location from the bus.
          {location && <div className="sub">Last updated: {ageLabel(location.recordedAt)}</div>}
        </div>
      )}
      {phase === "NOT_STARTED" && (
        <div className="banner info">
          Your bus is not on the map yet. It shows here live from about an hour before departure.
        </div>
      )}
      {!connected && (phase === "LIVE" || phase === "STALE") && (
        <div className="banner info">Connection lost — reconnecting…</div>
      )}
    </div>
  );
}
