"use client";

import { CircleMarker, MapContainer, TileLayer, Tooltip } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { NoData } from "./NoData";

type Point = { lat: number; lng: number; employee: string; time: string; onTime: boolean };

/**
 * Shift check-in locations (green = on-time, red = late). Leaflet needs `window`,
 * so this MUST be imported via next/dynamic with { ssr: false }.
 */
export default function ShiftLocationMap({ data }: { data: Point[] }) {
  const points = (data || []).filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
  if (points.length === 0) return <NoData message="لا توجد مواقع تسجيل دخول في هذه الفترة" />;

  const center: [number, number] = [points[0].lat, points[0].lng];

  return (
    <div style={{ width: "100%", height: 360 }} className="rounded-md overflow-hidden border">
      <MapContainer center={center} zoom={6} scrollWheelZoom={false} style={{ height: "100%", width: "100%" }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {points.map((p, i) => {
          const color = p.onTime ? "#22C55E" : "#EF4444";
          return (
            <CircleMarker
              key={i}
              center={[p.lat, p.lng]}
              radius={6}
              pathOptions={{ color, fillColor: color, fillOpacity: 0.6 }}
            >
              <Tooltip>
                {p.employee} — {p.time} ({p.onTime ? "في الوقت" : "متأخر"})
              </Tooltip>
            </CircleMarker>
          );
        })}
      </MapContainer>
    </div>
  );
}
