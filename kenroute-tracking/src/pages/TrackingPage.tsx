import { useState } from "react";
import { TrackingMap } from "../components/TrackingMap";
import { TrackingSearch } from "../components/TrackingSearch";
import { TrackingStatus } from "../components/TrackingStatus";
import { TripInfo } from "../components/TripInfo";
import { useLiveTracking } from "../hooks/useLiveTracking";

interface Props {
  initialToken?: string | null;
}

export function TrackingPage({ initialToken }: Props) {
  const [centerSignal, setCenterSignal] = useState(0);
  const { phase, trip, location, connected, errorMessage, searchPnr, reset } = useLiveTracking(initialToken);

  // The map is on screen as soon as the ticket is found; the bus joins it when it reports.
  const showMap = phase === "LIVE" || phase === "STALE" || phase === "NOT_STARTED";

  return (
    <div className="page">
      <header className="brand">
        <h1>
          Ken<span>Route</span>
        </h1>
        {initialToken && phase !== "SEARCH" ? <button className="link" onClick={reset}>← New search</button> : null}
      </header>

      {phase === "SEARCH" && (
        <main className="search-screen">
          <h2>Track Your Bus</h2>
          <p>Enter the PNR printed on your ticket.</p>
          <TrackingSearch onSearchPnr={searchPnr} />
        </main>
      )}

      {phase === "LOADING" && <main className="status-screen"><div className="spinner" /><p>Finding your bus…</p></main>}

      {phase === "NOT_FOUND" && (
        <main className="status-screen">
          <p>Please enter valid details.</p>
          <button className="primary" onClick={reset}>Try again</button>
        </main>
      )}

      {phase === "NETWORK_ERROR" && (
        <main className="status-screen">
          <p>{errorMessage ?? "Could not reach the server. Check your connection."}</p>
          <button className="primary" onClick={reset}>Try again</button>
        </main>
      )}

      {phase === "EXPIRED" && (
        <main className="status-screen">
          <p>This tracking session has expired. Please search again.</p>
          <button className="primary" onClick={reset}>Track again</button>
        </main>
      )}

      {phase === "COMPLETED" && trip && (
        <main className="status-screen">
          <TripInfo origin={trip.origin} destination={trip.destination} busNo={trip.bus.registrationNo} live={false} />
          <p>
            {trip.status === "CANCELLED" ? "This trip was cancelled." : "This trip has completed."}
          </p>
          <button className="primary" onClick={reset}>Track another bus</button>
        </main>
      )}

      {showMap && trip && (
        <main className="live-screen">
          <div className="live-header">
            <span className={phase === "LIVE" ? "pill live" : "pill stale"}>
              {phase === "LIVE" ? "🟢 LIVE" : phase === "STALE" ? "🟠 STALE" : "⏳ NOT STARTED"}
            </span>
            <TripInfo origin={trip.origin} destination={trip.destination} busNo={trip.bus.registrationNo} live={phase === "LIVE"} />
          </div>
          <TrackingMap location={location} centerSignal={centerSignal} />
          {location && <button className="center-btn" onClick={() => setCenterSignal((n) => n + 1)}>Center Bus</button>}
          <TrackingStatus phase={phase} location={location} connected={connected} />
        </main>
      )}
    </div>
  );
}
