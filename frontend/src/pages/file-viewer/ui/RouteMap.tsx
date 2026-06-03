import { useEffect, useRef } from "react";
import type L from "leaflet";

interface GpsPoint { ts: number; lat: number; lng: number; alt?: number }

type LType = typeof L;

export function RouteMap({ points }: { points: GpsPoint[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<L.Map | null>(null);
  const ptsRef       = useRef(points);
  ptsRef.current = points;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let map: L.Map;

    import("leaflet").then((leaflet) => {
      const L = (leaflet.default ?? leaflet) as LType;
      if (!containerRef.current) return;

      map = L.map(containerRef.current, { zoomControl: true });
      mapRef.current = map;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);

      const pts = ptsRef.current;
      const coords = pts.map(p => [p.lat, p.lng] as [number, number]);

      L.polyline(coords, { color: "#2563eb", weight: 3, opacity: 0.85 }).addTo(map);

      if (pts.length > 0) {
        L.circleMarker([pts[0].lat, pts[0].lng], {
          radius: 7, color: "#15803d", fillColor: "#22c55e", fillOpacity: 1, weight: 2,
        }).bindTooltip("Старт").addTo(map);
      }
      if (pts.length > 1) {
        const last = pts[pts.length - 1];
        L.circleMarker([last.lat, last.lng], {
          radius: 7, color: "#b91c1c", fillColor: "#ef4444", fillOpacity: 1, weight: 2,
        }).bindTooltip("Финиш").addTo(map);
      }

      if (coords.length > 1) {
        map.fitBounds(L.polyline(coords).getBounds(), { padding: [20, 20] });
      } else if (coords.length === 1) {
        map.setView(coords[0], 14);
      }
    });

    return () => {
      map?.remove();
      mapRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={containerRef} style={{ width: "100%", height: "100%" }} />;
}
