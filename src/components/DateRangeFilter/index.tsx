"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export interface ResolvedRange {
  from: string; // ISO
  to: string; // ISO
}

const PRESETS = [
  { label: "اليوم", value: "day" },
  { label: "الأسبوع الماضي", value: "week" },
  { label: "آخر أسبوعين", value: "2weeks" },
  { label: "الشهر الماضي", value: "month" },
  { label: "آخر 3 أشهر", value: "3months" },
  { label: "آخر 6 أشهر", value: "6months" },
  { label: "السنة الماضية", value: "year" },
  { label: "مخصص", value: "custom" },
];

function presetToRange(preset: string): ResolvedRange {
  const now = new Date();
  const from = new Date(now);
  switch (preset) {
    case "day":
      from.setDate(now.getDate() - 1);
      break;
    case "week":
      from.setDate(now.getDate() - 7);
      break;
    case "2weeks":
      from.setDate(now.getDate() - 14);
      break;
    case "month":
      from.setMonth(now.getMonth() - 1);
      break;
    case "3months":
      from.setMonth(now.getMonth() - 3);
      break;
    case "6months":
      from.setMonth(now.getMonth() - 6);
      break;
    case "year":
      from.setFullYear(now.getFullYear() - 1);
      break;
    default:
      from.setMonth(now.getMonth() - 6);
  }
  return { from: from.toISOString(), to: now.toISOString() };
}

/**
 * Date-range filter: preset Select (matching the legacy admin presets) plus an
 * optional custom from/to. Emits the resolved ISO range via `onChange` on mount
 * and on every change.
 */
export default function DateRangeFilter({
  defaultPreset = "6months",
  onChange,
}: {
  defaultPreset?: string;
  onChange: (range: ResolvedRange) => void;
}) {
  const [preset, setPreset] = useState(defaultPreset);
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  // Keep latest onChange without re-running the effect on identity changes.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (preset === "custom") {
      if (customFrom && customTo) {
        const from = new Date(customFrom);
        const to = new Date(customTo);
        to.setHours(23, 59, 59, 999);
        onChangeRef.current({ from: from.toISOString(), to: to.toISOString() });
      }
    } else {
      onChangeRef.current(presetToRange(preset));
    }
  }, [preset, customFrom, customTo]);

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {preset === "custom" && (
        <>
          <Input
            type="date"
            value={customFrom}
            onChange={(e) => setCustomFrom(e.target.value)}
            className="w-[150px] bg-white"
            aria-label="من تاريخ"
          />
          <Input
            type="date"
            value={customTo}
            onChange={(e) => setCustomTo(e.target.value)}
            className="w-[150px] bg-white"
            aria-label="إلى تاريخ"
          />
        </>
      )}
      <Select value={preset} onValueChange={setPreset}>
        <SelectTrigger className="w-[180px] bg-white border border-gray-300 rounded-lg">
          <SelectValue placeholder="اختر المدة الزمنية" />
        </SelectTrigger>
        <SelectContent>
          {PRESETS.map((p) => (
            <SelectItem key={p.value} value={p.value}>
              {p.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
