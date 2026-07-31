"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Loader2 } from "lucide-react";
import { toast } from "sonner";

export type LatLng = { lat: number; lng: number };

// Riyadh — a sensible default view before any pin is placed.
const DEFAULT_CENTER: [number, number] = [24.7136, 46.6753];

// A CSS-only pin so we never depend on Leaflet's default marker image asset
// (which breaks under the bundler). Brand blue to match the app.
const pinIcon = L.divIcon({
  className: "",
  html: `<div style="width:22px;height:22px;transform:translate(-50%,-100%)">
    <svg viewBox="0 0 24 24" width="22" height="22" fill="#5570F1" stroke="white" stroke-width="1.5">
      <path d="M12 2C7.6 2 4 5.6 4 10c0 5.5 8 12 8 12s8-6.5 8-12c0-4.4-3.6-8-8-8z"/>
      <circle cx="12" cy="10" r="3" fill="white" stroke="none"/>
    </svg>
  </div>`,
  iconSize: [22, 22],
  iconAnchor: [11, 22],
});

/** Sets the pin on map click. */
function ClickCapture({ onPick }: { onPick: (p: LatLng) => void }) {
  useMapEvents({
    click(e) {
      onPick({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}

/** Recenters the map when the value changes (e.g. after an address search). */
function Recenter({ value }: { value: LatLng | null }) {
  const map = useMap();
  useEffect(() => {
    if (value) map.setView([value.lat, value.lng], Math.max(map.getZoom(), 15));
  }, [value, map]);
  return null;
}

/**
 * Map-based hospital location picker: search an address (free OSM Nominatim),
 * click the map to drop the pin, or drag the pin to fine-tune. Emits { lat, lng }.
 * Leaflet needs `window`, so import this via next/dynamic with { ssr: false }.
 */
export default function HospitalLocationPicker({
  value,
  onChange,
}: {
  value: LatLng | null;
  onChange: (p: LatLng) => void;
}) {
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);

  const center: [number, number] = value ? [value.lat, value.lng] : DEFAULT_CENTER;

  const search = async () => {
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`,
        { headers: { "Accept-Language": "ar" } },
      );
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        onChange({ lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) });
      } else {
        toast.error("لم يتم العثور على الموقع. جرّب اسمًا أو عنوانًا مختلفًا.");
      }
    } catch {
      toast.error("تعذّر البحث عن الموقع. حاول مرة أخرى.");
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          placeholder="ابحث عن اسم المستشفى أو العنوان..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              search();
            }
          }}
        />
        <Button type="button" variant="outline" onClick={search} disabled={searching}>
          {searching ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
        </Button>
      </div>

      <div style={{ width: "100%", height: 300 }} className="rounded-md overflow-hidden border">
        <MapContainer center={center} zoom={value ? 15 : 6} scrollWheelZoom style={{ height: "100%", width: "100%" }}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <ClickCapture onPick={onChange} />
          <Recenter value={value} />
          {value && (
            <Marker
              position={[value.lat, value.lng]}
              icon={pinIcon}
              draggable
              eventHandlers={{
                dragend: (e) => {
                  const p = e.target.getLatLng();
                  onChange({ lat: p.lat, lng: p.lng });
                },
              }}
            />
          )}
        </MapContainer>
      </div>

      <p className="text-xs text-gray-500">
        {value
          ? `الموقع المحدد: ${value.lat.toFixed(5)}, ${value.lng.toFixed(5)}`
          : "ابحث ثم انقر على الخريطة لتحديد موقع المستشفى."}
      </p>
    </div>
  );
}
