import { useEffect, useRef } from "react";
import L from "leaflet";
import type { LocationFix } from "../types/tracking";

interface Props {
  location: LocationFix | null;
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

export function TrackingMap({ location, centerSignal }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const firstFix = useRef(true);

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
    };
  }, []);

  useEffect(() => {
    if (!location || !mapRef.current) return;
    const heading = typeof location.heading === "number" && !Number.isNaN(location.heading) ? location.heading : 0;
    const icon = L.divIcon({
      className: "bus-marker",
      html: `<div style="transform: rotate(${heading}deg)">${BUS_SVG}</div>`,
      iconSize: [40, 40],
      iconAnchor: [20, 20],
    });
    if (!markerRef.current) {
      markerRef.current = L.marker([location.latitude, location.longitude], { icon }).addTo(mapRef.current);
    } else {
      markerRef.current.setLatLng([location.latitude, location.longitude]);
      markerRef.current.setIcon(icon);
    }
    if (firstFix.current) {
      firstFix.current = false;
      mapRef.current.setView([location.latitude, location.longitude], 14);
    }
  }, [location]);

  useEffect(() => {
    if (centerSignal > 0 && location && mapRef.current) {
      mapRef.current.flyTo([location.latitude, location.longitude], 15, { duration: 0.8 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centerSignal]);

  return <div className="map-container" ref={containerRef} />;
}
