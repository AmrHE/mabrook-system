"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { AlertTriangle, Clock, Copy, FileX, MapPinOff, PhoneOff } from "lucide-react";
import { fmtNumber } from "./constants";
import { DQ_CATEGORIES, type DqCategory } from "@/utils/analytics/dataQualityCategories";

interface QualityStats {
  momsMissingPhone?: number;
  momsMissingNationality?: number;
  unsignedMoms?: number;
  duplicatePhones?: number;
  visitsWithZeroMoms?: number;
  openShifts?: number;
}

// Presentation only — slugs/labels/columns live in the shared config.
const ICONS: Record<DqCategory["statKey"], { icon: ReactNode; color: string }> = {
  momsMissingPhone: { icon: <PhoneOff className="size-4" />, color: "text-red-600" },
  momsMissingNationality: { icon: <MapPinOff className="size-4" />, color: "text-amber-600" },
  unsignedMoms: { icon: <FileX className="size-4" />, color: "text-amber-600" },
  duplicatePhones: { icon: <Copy className="size-4" />, color: "text-amber-600" },
  visitsWithZeroMoms: { icon: <AlertTriangle className="size-4" />, color: "text-orange-600" },
  openShifts: { icon: <Clock className="size-4" />, color: "text-orange-600" },
};

export default function DataQualityPanel({
  stats,
  range,
}: {
  stats: QualityStats | null;
  range?: { from: string; to: string } | null;
}) {
  const s = stats || {};
  const items = DQ_CATEGORIES.map((c) => ({ ...c, value: s[c.statKey], ...ICONS[c.statKey] }));

  const allClear = items.every((i) => !i.value);
  if (allClear) {
    return (
      <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
        لا توجد مشكلات في البيانات 🎉
      </div>
    );
  }

  const href = (slug: string) => {
    const q = range ? `?from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}` : "";
    return `/analytics/data-quality/${slug}${q}`;
  };

  return (
    <div className="space-y-2">
      {items.map((i) => {
        const row = (
          <div
            className={`flex items-center justify-between bg-gray-50 rounded-md px-3 py-2 text-sm ${
              i.value ? "hover:bg-gray-100 transition-colors" : ""
            }`}
          >
            <span className={`flex items-center gap-2 ${i.value ? i.color : "text-gray-400"}`}>
              {i.icon}
              {i.label}
            </span>
            <span className={`font-bold ${i.value ? "" : "text-gray-400"}`}>{fmtNumber(i.value || 0)}</span>
          </div>
        );
        return i.value ? (
          <Link key={i.slug} href={href(i.slug)} className="block">
            {row}
          </Link>
        ) : (
          <div key={i.slug}>{row}</div>
        );
      })}
    </div>
  );
}
