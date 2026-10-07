import { useEffect, useRef } from "react";
import L from "leaflet";
import type { LocationFix, StopInfo } from "../types/tracking";

interface Props {
  location: LocationFix | null;
  /** The passenger's own boarding or dropping point, when its position is known. */
  stop: StopInfo | null;
  /** Increment to force a recenter on the bus. */
  centerSignal: number;
}

const BUS_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="40" height="40">
  <rect x="8" y="4" width="32" height="38" rx="7" fill="#0f2a4a" stroke="#22c55e" stroke-width="2.5"/>
  <rect x="13" y="10" width="22" height="9" rx="2.5" fill="#7dd3fc"/>
  <rect x="13" y="23" width="9" height="7" rx="2" fill="#e2e8f0"/>
  <rect x="26" y="23" width="9" height="7" rx="2" fill="#e2e8f0"/>
  <circle cx="16" cy="39" r="2.6" fill="#22c55e"/>
  <circle cx="32" cy="39" r="2.6" fill="#22c55e"/>
</svg>`;

const STOP_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 44" width="30" height="42">
  <path d="M16 1C7.7 1 1 7.7 1 16c0 11 15 27 15 27s15-16 15-27C31 7.7 24.3 1 16 1z" fill="#dc2626" stroke="#fff" stroke-width="2"/>
  <circle cx="16" cy="16" r="6" fill="#fff"/>
</svg>`;

export function TrackingMap({ location, stop, centerSignal }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const stopRef = useRef<L.Marker | null>(null);
  /** What the view was last framed around, so the map moves only when that changes. */
  const framed = useRef("");

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, { zoomControl: true, attributionControl: true }).setView([20.5937, 78.9629], 5);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; <a href=\"https://www.openstreetmap.org/copyright\">OpenStreetMap</a> contributors",
    }).addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
      stopRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (location) {
      const heading = typeof location.heading === "number" && !Number.isNaN(location.heading) ? location.heading : 0;
      const icon = L.divIcon({
        className: "bus-marker",
        html: `<div style="transform: rotate(${heading}deg)">${BUS_SVG}</div>`,
        iconSize: [40, 40],
        iconAnchor: [20, 20],
      });
      if (!markerRef.current) {
        markerRef.current = L.marker([location.latitude, location.longitude], { icon, zIndexOffset: 1000 }).addTo(map);
      } else {
        markerRef.current.setLatLng([location.latitude, location.longitude]);
        markerRef.current.setIcon(icon);
      }
    }

    if (stop) {
      const label = `${stop.kind === "BOARDING" ? "Your boarding point" : "Your dropping point"}: ${stop.name}`;
      if (!stopRef.current) {
        const icon = L.divIcon({ className: "stop-marker", html: STOP_SVG, iconSize: [30, 42], iconAnchor: [15, 42] });
        stopRef.current = L.marker([stop.latitude, stop.longitude], { icon }).addTo(map);
        stopRef.current.bindTooltip(label, { permanent: true, direction: "top", offset: [0, -40] });
      } else {
        stopRef.current.setLatLng([stop.latitude, stop.longitude]);
        stopRef.current.setTooltipContent(label);
      }
    } else if (stopRef.current) {
      stopRef.current.remove();
      stopRef.current = null;
    }

    // Frame the bus and the stop together the first time each is known (and again when
    // the stop changes from boarding to dropping); after that the passenger owns the view.
    const frame = `${location ? "bus" : ""}|${stop ? `${stop.kind}:${stop.name}` : ""}`;
    if (frame !== framed.current) {
      framed.current = frame;
      if (location && stop) {
        map.fitBounds([[location.latitude, location.longitude], [stop.latitude, stop.longitude]], { padding: [60, 60], maxZoom: 15 });
      } else if (location) {
        map.setView([location.latitude, location.longitude], 14);
      } else if (stop) {
        map.setView([stop.latitude, stop.longitude], 14);
      }
    }
  }, [location, stop]);

  useEffect(() => {
    if (centerSignal > 0 && location && mapRef.current) {
      mapRef.current.flyTo([location.latitude, location.longitude], 15, { duration: 0.8 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centerSignal]);

  return <div className="map-container" ref={containerRef} />;
}
