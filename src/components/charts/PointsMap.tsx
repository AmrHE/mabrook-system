"use client";

import { useEffect } from "react";
import { CircleMarker, MapContainer, Polyline, TileLayer, Tooltip, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { NoData } from "./NoData";

export type MapPoint = { lat: number; lng: number; label: string; color: string };

/** Recenters/zooms the map to fit all points once they're available. */
function FitBounds({ points }: { points: MapPoint[] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 1) {
      map.setView([points[0].lat, points[0].lng], 15);
    } else if (points.length > 1) {
      map.fitBounds(points.map((p) => [p.lat, p.lng]) as [number, number][], { padding: [40, 40] });
    }
  }, [map, points]);
  return null;
}

/**
 * Renders one or more labelled coordinates on a Leaflet map (with a dashed line
 * between them when there is more than one). Leaflet needs `window`, so import
 * this via next/dynamic with { ssr: false }.
 */
export default function PointsMap({ points }: { points: MapPoint[] }) {
  if (points.length === 0) return <NoData message="لا يوجد موقع مسجّل" />;

  const center: [number, number] = [points[0].lat, points[0].lng];

  return (
    <div style={{ width: "100%", height: 380 }} className="rounded-md overflow-hidden border">
      <MapContainer center={center} zoom={14} scrollWheelZoom style={{ height: "100%", width: "100%" }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {points.length > 1 && (
          <Polyline
            positions={points.map((p) => [p.lat, p.lng]) as [number, number][]}
            pathOptions={{ color: "#5570F1", dashArray: "6" }}
          />
        )}
        {points.map((p, i) => (
          <CircleMarker
            key={i}
            center={[p.lat, p.lng]}
            radius={9}
            pathOptions={{ color: p.color, fillColor: p.color, fillOpacity: 0.75 }}
          >
            <Tooltip permanent direction="top">
              {p.label}
            </Tooltip>
          </CircleMarker>
        ))}
        <FitBounds points={points} />
      </MapContainer>
    </div>
  );
}
