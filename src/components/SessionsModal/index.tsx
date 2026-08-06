"use client";

import { useState } from "react";
import { Clock } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { formatSessionSpan } from "@/utils/shift/labels";
import LocationModal from "@/components/LocationModal";

type Coord = { lat: number; lng: number } | null;

export interface ShiftSessionRow {
  startTime: string | Date;
  endTime?: string | Date | null;
  autoClosed?: boolean;
  closeReason?: string;
  startLoc?: Coord;
  endLoc?: Coord;
  /** This session's OWN hospital — a day can be resumed elsewhere. */
  hospitalLoc?: Coord;
}

/**
 * The individual check-in → check-out sessions behind one day-shift row.
 *
 * A modal on the session-count cell rather than an expandable row: it reuses the
 * pattern `LocationModal` already establishes in these same tables, needs no
 * changes to the shared `DataTable`, and keeps the CSV export flat (the rows
 * carry a `sessionsText` column for that).
 */
export default function SessionsModal({
  sessions,
  count,
}: {
  sessions?: ShiftSessionRow[] | null;
  count?: number;
}) {
  const [open, setOpen] = useState(false);
  const list = sessions ?? [];
  const label = String(count ?? list.length ?? 0);

  // A single session has nothing to expand into.
  if (list.length <= 1) return <span>{label}</span>;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1 text-[#5570F1] underline underline-offset-2 cursor-pointer"
        >
          <Clock className="size-3.5" />
          {label}
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle>جلسات اليوم</DialogTitle>
        </DialogHeader>
        <ol className="space-y-2">
          {list.map((s, i) => (
            <li key={i} className="flex items-center justify-between gap-4 text-sm border-b border-gray-100 pb-2 last:border-0">
              <span className="text-gray-500">الجلسة {i + 1}</span>
              <span className="font-medium">{formatSessionSpan(s.startTime, s.endTime)}</span>
              {/* Each session against ITS OWN hospital — a day resumed at a
                  second hospital must not be judged against the first. */}
              <LocationModal
                start={s.startLoc}
                end={s.endLoc}
                hospital={s.hospitalLoc}
                startLabel="بداية الجلسة"
                endLabel="نهاية الجلسة"
                title={`موقع الجلسة ${i + 1}`}
                triggerText="الموقع"
              />
              <span className="text-gray-400 text-xs">
                {s.autoClosed ? s.closeReason || "إغلاق تلقائي" : ""}
              </span>
            </li>
          ))}
        </ol>
      </DialogContent>
    </Dialog>
  );
}
