interface Props {
  origin: string;
  destination: string;
  busNo: string;
  live: boolean;
}

export function TripInfo({ origin, destination, busNo, live }: Props) {
  return (
    <div className="trip-info">
      <div className="route-line">
        {origin} <span className="arrow">→</span> {destination}
      </div>
      <div className="bus-line">
        Bus: {busNo}
        <span className={live ? "live-dot on" : "live-dot"} />
        {live ? <span className="live-label">LIVE</span> : null}
      </div>
    </div>
  );
}
