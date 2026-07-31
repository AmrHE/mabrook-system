"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { MapPin } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { MapPoint } from "@/components/charts/PointsMap";

// Leaflet must never run on the server.
const PointsMap = dynamic(() => import("@/components/charts/PointsMap"), { ssr: false });

type Coord = { lat?: number; lng?: number } | null | undefined;

const isCoord = (c: Coord): c is { lat: number; lng: number } =>
  !!c && Number.isFinite(c.lat) && Number.isFinite(c.lng);

/**
 * Clickable coordinate that opens a modal map. Pass a shift's `start`/`end` (green
 * check-in, red check-out) or a single point. Renders "—" when no coordinate exists.
 * Reused everywhere coordinates are displayed.
 */
export default function LocationModal({
  start,
  end,
  hospital,
  startLabel = "بداية الدوام",
  endLabel = "نهاية الدوام",
  hospitalLabel = "موقع المستشفى",
  title = "الموقع الجغرافي",
  triggerText,
}: {
  start?: Coord;
  end?: Coord;
  hospital?: Coord;
  startLabel?: string;
  endLabel?: string;
  hospitalLabel?: string;
  title?: string;
  triggerText?: string;
}) {
  const [open, setOpen] = useState(false);

  const points: MapPoint[] = [];
  // Hospital anchor first (blue) so a start→end line isn't distorted by it.
  if (isCoord(hospital)) points.push({ lat: hospital.lat, lng: hospital.lng, label: hospitalLabel, color: "#5570F1" });
  if (isCoord(start)) points.push({ lat: start.lat, lng: start.lng, label: startLabel, color: "#22C55E" });
  if (isCoord(end)) points.push({ lat: end.lat, lng: end.lng, label: endLabel, color: "#EF4444" });

  if (points.length === 0) return <span className="text-gray-400">—</span>;

  const label = triggerText ?? `${points[0].lat.toFixed(4)}, ${points[0].lng.toFixed(4)}`;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          title={label}
          className="inline-flex max-w-[180px] items-center gap-1 text-[#5570F1] hover:underline cursor-pointer"
        >
          <MapPin className="size-3.5 shrink-0" />
          <span className="truncate">{label}</span>
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <PointsMap points={points} />
        <div className="flex flex-wrap gap-4 text-xs text-gray-600">
          {isCoord(hospital) && (
            <span className="flex items-center gap-1">
              <span className="size-2 rounded-full bg-[#5570F1]" /> {hospitalLabel}
            </span>
          )}
          {isCoord(start) && (
            <span className="flex items-center gap-1">
              <span className="size-2 rounded-full bg-green-500" /> {startLabel}
            </span>
          )}
          {isCoord(end) && (
            <span className="flex items-center gap-1">
              <span className="size-2 rounded-full bg-red-500" /> {endLabel}
            </span>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
