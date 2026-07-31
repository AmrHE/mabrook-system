"use client";

import { CircleMarker, MapContainer, TileLayer, Tooltip } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { fmtNumber, pct } from "./constants";
import { NoData } from "./NoData";

type Point = { lat: number; lng: number; hospital: string; city: string; moms: number };

/**
 * Leaflet visit-coverage map (CircleMarkers avoid the default-icon asset issue).
 * MUST be imported via next/dynamic with { ssr: false } — Leaflet needs `window`.
 */
export default function VisitCoverageMap({ data }: { data: Point[] }) {
  const points = (data || []).filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
  if (points.length === 0) return <NoData message="لا توجد إحداثيات للزيارات في هذه الفترة" />;

  const center: [number, number] = [points[0].lat, points[0].lng];
  // Share of all moms (across the full range, incl. hospitals without coordinates).
  const totalMoms = (data || []).reduce((s, p) => s + (p.moms || 0), 0);

  return (
    <div style={{ width: "100%", height: 360 }} className="rounded-md overflow-hidden border">
      <MapContainer center={center} zoom={6} scrollWheelZoom={false} style={{ height: "100%", width: "100%" }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {points.map((p, i) => (
          <CircleMarker
            key={i}
            center={[p.lat, p.lng]}
            radius={6}
            pathOptions={{ color: "#5570F1", fillColor: "#5570F1", fillOpacity: 0.6 }}
          >
            <Tooltip>
              {p.hospital}
              {p.city ? ` — ${p.city}` : ""}: {fmtNumber(p.moms)} ({pct(p.moms, totalMoms)}%)
            </Tooltip>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );
}
