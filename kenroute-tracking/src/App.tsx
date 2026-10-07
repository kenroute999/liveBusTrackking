import { useMemo } from "react";
import { TrackingPage } from "./pages/TrackingPage";

function tokenFromPath(): string | null {
  const m = window.location.pathname.match(/^\/t\/([^/]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

export function App() {
  const initialToken = useMemo(() => tokenFromPath(), []);
  return <TrackingPage initialToken={initialToken} />;
}
