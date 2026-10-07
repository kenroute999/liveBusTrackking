import type { LocationResponse, LookupResponse } from "../types/tracking";

const BASE_URL: string = import.meta.env.VITE_API_URL ?? "";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function send<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  } catch {
    throw new ApiError(0, "NETWORK_ERROR", "Could not reach the server. Check your connection.");
  }
  const payload = await res.json().catch(() => null);
  if (!res.ok) {
    const err = payload as { error?: { code?: string; message?: string; details?: Record<string, unknown> } } | null;
    throw new ApiError(res.status, err?.error?.code ?? "UNKNOWN", err?.error?.message ?? `Request failed (${res.status})`, err?.error?.details ?? {});
  }
  return payload as T;
}

export function lookupByPnr(pnr: string): Promise<LookupResponse> {
  return send("/tracking/lookup", { method: "POST", body: JSON.stringify({ pnr }) });
}

export function lookupByMobile(mobile: string): Promise<LookupResponse> {
  return send("/tracking/lookup", { method: "POST", body: JSON.stringify({ mobile }) });
}

export function fetchCurrentLocation(token: string): Promise<LocationResponse> {
  return send("/tracking/location", { headers: { Authorization: `Bearer ${token}` } });
}
