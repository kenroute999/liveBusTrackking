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

export interface LookupResponse {
  token: string;
  expiresInSeconds: number;
  trip: TripInfo;
  location: LocationFix | null;
}

export interface LocationResponse {
  trip: TripInfo;
  location: LocationFix | null;
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
  | "NETWORK_ERROR"
  | "SOCKET_DISCONNECTED";
