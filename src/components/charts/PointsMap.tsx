"use client";

import { useEffect } from "react";
import { Circle, CircleMarker, MapContainer, Polyline, TileLayer, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { NoData } from "./NoData";

export type MapPoint = { lat: number; lng: number; label: string; color: string };

/**
 * The geofence zone around a hospital. Radius is in METERS and scales with zoom —
 * hence `Circle` rather than `CircleMarker`, whose radius is in screen pixels and
 * would misstate the zone at every zoom level.
 */
export type MapCircle = { lat: number; lng: number; radiusMeters: number };

/** Recenters/zooms the map to fit all points — and the zone circle — once they're available. */
function FitBounds({ points, circle }: { points: MapPoint[]; circle?: MapCircle }) {
  const map = useMap();
  useEffect(() => {
    let bounds: L.LatLngBounds | null = points.length
      ? L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number]))
      : null;

    // The zone routinely dwarfs the points: a 2.5 km circle around a fix 200 m
    // from the hospital falls entirely off-screen at the zoom that fits the
    // points alone. `toBounds` gives the circle's bounding square without
    // constructing a layer just to measure it.
    if (circle) {
      const circleBounds = L.latLng(circle.lat, circle.lng).toBounds(circle.radiusMeters * 2);
      bounds = bounds ? bounds.extend(circleBounds) : circleBounds;
    }

    if (!bounds) return;
    // A lone point has no extent to fit, so it needs a chosen zoom — but only
    // when there is no circle, since the circle supplies an extent of its own.
    if (!circle && points.length === 1) {
      map.setView([points[0].lat, points[0].lng], 15);
    } else {
      map.fitBounds(bounds, { padding: [40, 40] });
    }
  }, [map, points, circle]);
  return null;
}

/**
 * Renders one or more labelled coordinates on a Leaflet map (with a dashed line
 * between them when there is more than one), optionally inside the hospital's
 * geofence zone. Leaflet needs `window`, so import this via next/dynamic with
 * { ssr: false }.
 */
export default function PointsMap({ points, circle }: { points: MapPoint[]; circle?: MapCircle }) {
  if (points.length === 0) return <NoData message="لا يوجد موقع مسجّل" />;

  const center: [number, number] = [points[0].lat, points[0].lng];

  return (
    <div style={{ width: "100%", height: 380 }} className="rounded-md overflow-hidden border">
      <MapContainer center={center} zoom={14} scrollWheelZoom style={{ height: "100%", width: "100%" }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {/* First, so the markers and the track stay legible on top of it. */}
        {circle && (
          <Circle
            center={[circle.lat, circle.lng]}
            radius={circle.radiusMeters}
            pathOptions={{
              color: "#5570F1",
              fillColor: "#5570F1",
              fillOpacity: 0.08,
              weight: 1,
              dashArray: "4",
            }}
          />
        )}
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
        <FitBounds points={points} circle={circle} />
      </MapContainer>
    </div>
  );
}
