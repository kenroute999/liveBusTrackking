import { useEffect, useRef } from "react";
import L from "leaflet";
import type { LocationFix, StopInfo } from "../types/tracking";
import { glideBus, isJump } from "./busMotion";
import { webglAvailable } from "./bus3d/webgl";
import type { BusHandle } from "./bus3d/BusCanvas";

interface Props {
  location: LocationFix | null;
  /** The passenger's own boarding or dropping point, when its position is known. */
  stop: StopInfo | null;
  /** The road from the bus to the stop; a straight dashed line is drawn until it is known. */
  road: [number, number][] | null;
  /** Increment to force a recenter on the bus. */
  centerSignal: number;
  /** Keep the view centred on the bus as it moves. */
  follow: boolean;
  /** Flip the follow mode from the parent (the Follow button in the header). */
  onFollowChange: (on: boolean) => void;
}

const STOP_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 44" width="30" height="42">
  <path d="M16 1C7.7 1 1 7.7 1 16c0 11 15 27 15 27s15-16 15-27C31 7.7 24.3 1 16 1z" fill="#dc2626" stroke="#fff" stroke-width="2"/>
  <circle cx="16" cy="16" r="6" fill="#fff"/>
</svg>`;

/** Pixel size of the square WebGL overlay that holds the 3D bus. It is deliberately
 *  larger than the bus so the model always sits fully inside it, never clipped by the
 *  canvas edge and never appears to sink into the map. */
const CANVAS_PX = 220;

export function TrackingMap({ location, stop, road, centerSignal, follow, onFollowChange }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const stopRef = useRef<L.Marker | null>(null);
  const lineRef = useRef<L.Polyline | null>(null);
  /** Cancel the running glide so a new fix can take over cleanly. */
  const cancelRef = useRef<(() => void) | null>(null);
  /** The last fix the bus has settled on, so the next hop glides from it. */
  const settledRef = useRef<LocationFix | null>(null);
  /** What the view was last framed around, so the map moves only when that changes. */
  const framed = useRef("");
  const followRef = useRef(follow);
  followRef.current = follow;

  /** The 3D bus handle and its overlay canvas; both null when WebGL is unavailable. */
  const threeHandleRef = useRef<BusHandle | null>(null);
  const threeCanvasRef = useRef<HTMLCanvasElement | null>(null);
  /** Last heading in degrees, reused so the 3D bus can be turned on map moves. */
  const headingRef = useRef(0);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, { zoomControl: true, attributionControl: true }).setView([20.5937, 78.9629], 5);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; <a href=\"https://www.openstreetmap.org/copyright\">OpenStreetMap</a> contributors",
    }).addTo(map);
    mapRef.current = map;

    // The 3D bus is preferred; the flat marker is kept as a fallback and as the
    // on-screen anchor. WebGL support is probed once, on mount. The Three.js module is
    // loaded on demand so it stays out of the initial download on slow phones.
    let disposeThree: (() => void) | null = null;
    let cancelled = false;
    if (webglAvailable()) {
      const canvas = document.createElement("canvas");
      canvas.width = CANVAS_PX;
      canvas.height = CANVAS_PX;
      canvas.style.position = "absolute";
      canvas.style.pointerEvents = "none"; // the map keeps every gesture
      canvas.style.transform = "translate(-50%, -50%)";
      canvas.style.willChange = "transform";
      canvas.style.zIndex = "450"; // above the tiles, below the stop pin
      canvas.style.display = "none"; // shown once a real fix arrives
      containerRef.current.appendChild(canvas);
      threeCanvasRef.current = canvas;

      void import("./bus3d/BusCanvas").then(({ mountBus3d }) => {
        if (cancelled || !containerRef.current?.contains(canvas)) {
          return; // unmounted while the engine was still downloading
        }
        const { handle, dispose } = mountBus3d(canvas, CANVAS_PX);
        threeHandleRef.current = handle;
        if (settledRef.current) syncThree();
        disposeThree = dispose;
      });
    }

    return () => {
      cancelled = true;
      cancelRef.current?.();
      cancelRef.current = null;
      disposeThree?.();
      threeHandleRef.current = null;
      threeCanvasRef.current?.remove();
      threeCanvasRef.current = null;
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
      stopRef.current = null;
      lineRef.current = null;
      settledRef.current = null;
    };
  }, []);

  /** Keeps the 3D canvas glued to the bus's screen position as the map pans/zooms. */
  const syncThree = () => {
    const map = mapRef.current;
    const marker = markerRef.current;
    const handle = threeHandleRef.current;
    const canvas = threeCanvasRef.current;
    if (!map || !marker || !handle || !canvas) return;
    const ll = marker.getLatLng();
    const pt = map.latLngToContainerPoint(ll);
    canvas.style.left = `${pt.x}px`;
    canvas.style.top = `${pt.y}px`;

    // Keep the bus a constant, marker-like size on screen. It grows only slightly with
    // zoom and is clamped, so it never swells past the canvas or shrinks away.
    const z = map.getZoom();
    const scale = Math.min(0.72, Math.max(0.34, 0.38 + (z - 10) * 0.034));
    handle.setHeadingAndScale(Math.PI - (headingRef.current * Math.PI) / 180, scale);
    handle.render();
  };

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.on("move zoom", syncThree);
    return () => {
      map.off("move zoom", syncThree);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The way from the bus to the passenger's stop.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    lineRef.current?.remove();
    lineRef.current = null;
    if (!location || !stop) return;
    lineRef.current = road
      ? L.polyline(road, { color: "#2563eb", weight: 5, opacity: 0.85 }).addTo(map)
      : L.polyline(
          [[location.latitude, location.longitude], [stop.latitude, stop.longitude]],
          { color: "#2563eb", weight: 3, opacity: 0.7, dashArray: "6 8" },
        ).addTo(map);
  }, [location, stop, road]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (location) {
      const canvas = threeCanvasRef.current;
      if (canvas) canvas.style.display = "";

      // The previous fix the bus settled on, so this hop can glide from there.
      const prev = settledRef.current;
      const from = prev && (prev.latitude !== location.latitude || prev.longitude !== location.longitude) ? prev : null;
      headingRef.current = location.heading ?? 0;

      // An invisible Leaflet marker carries the real GPS coordinate; the 3D bus is
      // drawn on top of it at that marker's screen position.
      if (!markerRef.current) {
        const anchorIcon = L.divIcon({ className: "bus-anchor", html: "", iconSize: [1, 1], iconAnchor: [0, 0] });
        markerRef.current = L.marker([location.latitude, location.longitude], { icon: anchorIcon, interactive: false }).addTo(map);
      }

      const step = (pos: [number, number], heading: number) => {
        markerRef.current?.setLatLng(pos);
        headingRef.current = heading;
        settledRef.current = { ...location, latitude: pos[0], longitude: pos[1] };
        if (followRef.current) map.panTo(pos, { animate: true, duration: 0.4, noMoveStart: true });
        syncThree();
      };

      // A jump or a first fix snaps; anything closer eases from the last position.
      cancelRef.current?.();
      cancelRef.current = null;
      if (from && !isJump(from, location)) {
        cancelRef.current = glideBus(from, location, step, step);
      } else {
        step([location.latitude, location.longitude], location.heading ?? 0);
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

  return (
    <div className="map-container" ref={containerRef}>
      <button type="button" className={follow ? "follow-btn on" : "follow-btn"} onClick={() => onFollowChange(!follow)}>
        {follow ? "Following ●" : "Follow bus"}
      </button>
    </div>
  );
}