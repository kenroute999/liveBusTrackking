export interface TripInfo {
  status: "SCHEDULED" | "BOARDING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" | "MAINTENANCE";
  origin: string;
  destination: string;
  departureAt: string;
  arrivalAt: string;
  bus: { registrationNo: string; name: string | null };
}

export interface LocationFix {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  speed: number | null;
  heading: number | null;
  recordedAt: string;
}

/** The passenger's own stop: where they board, or once on the bus, where they get down. */
export interface StopInfo {
  kind: "BOARDING" | "DROPPING";
  name: string;
  latitude: number;
  longitude: number;
  /** Road distance from the bus, and minutes to reach the stop; null until the bus reports. */
  distanceKm: number | null;
  etaMinutes: number | null;
}

export interface LookupResponse {
  token: string;
  expiresInSeconds: number;
  trip: TripInfo;
  location: LocationFix | null;
  stop: StopInfo | null;
}

export interface LocationResponse {
  trip: TripInfo;
  location: LocationFix | null;
  stop: StopInfo | null;
}

export type TrackingPhase =
  | "SEARCH"
  | "LOADING"
  | "LIVE"
  | "STALE"
  | "NOT_STARTED"
  | "COMPLETED"
  | "NOT_FOUND"
  | "EXPIRED"
  | "NETWORK_ERROR";
