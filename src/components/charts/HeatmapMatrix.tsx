"use client";

import { useMemo, useState } from "react";
import { TIMEZONE } from "@/utils/date/range";
import { fmtNumber } from "./constants";
import { NoData } from "./NoData";

// $dayOfWeek: 1 = Sunday .. 7 = Saturday → index 0..6
const DAYS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const LEGEND_STEPS = [0.15, 0.35, 0.55, 0.75, 1];

function fmtDay(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-SA", { day: "numeric", month: "short", year: "numeric", timeZone: TIMEZONE });
}

interface Cell {
  dow: number;
  hour: number;
  count: number;
}

/**
 * Weekday × hour-of-day activity heatmap. Self-describing: shows what metric it
 * counts ({metricLabel}), the date range it aggregates over, the timezone, the
 * total and the peak cell, plus a color legend.
 */
export default function HeatmapMatrix({
  data,
  max,
  metricLabel = "النشاط",
  valueNoun = "",
  from,
  to,
}: {
  data: Cell[];
  max: number;
  /** What each count represents, e.g. "تسجيلات الأمهات". */
  metricLabel?: string;
  /** Singular unit for tooltips/peak, e.g. "أم". */
  valueNoun?: string;
  /** ISO range bounds — rendered as a caption so the period is explicit. */
  from?: string;
  to?: string;
}) {
  const { lookup, total, peak } = useMemo<{
    lookup: Map<string, number>;
    total: number;
    peak: Cell | null;
  }>(() => {
    const m = new Map<string, number>();
    let sum = 0;
    let top: Cell | null = null;
    (data || []).forEach((d) => {
      m.set(`${d.dow}-${d.hour}`, d.count);
      sum += d.count || 0;
      if (!top || d.count > top.count) top = d;
    });
    return { lookup: m, total: sum, peak: top };
  }, [data]);

  const [hover, setHover] = useState<{ dow: number; hour: number; count: number; x: number; y: number } | null>(null);

  if (!data || data.length === 0) return <NoData />;
  const maxVal = max || 1;
  const rangeLabel = from && to ? `${fmtDay(from)} — ${fmtDay(to)}` : "";

  return (
    <div>
      {/* Descriptive header */}
      <div className="mb-3">
        <p className="text-sm font-medium text-gray-700">{metricLabel} حسب يوم الأسبوع وساعة اليوم</p>
        <p className="text-xs text-muted-foreground">
          مُجمّعة عبر كامل الفترة المحددة · بتوقيت الرياض{rangeLabel ? ` · ${rangeLabel}` : ""}
        </p>
      </div>

      {/* Summary chips */}
      <div className="flex flex-wrap gap-2 mb-3 text-xs">
        <span className="bg-gray-50 border rounded-md px-2 py-1">
          الإجمالي: <span className="font-bold">{fmtNumber(total)}</span>
          {valueNoun ? ` ${valueNoun}` : ""}
        </span>
        {peak && peak.count > 0 && (
          <span className="bg-[#5570F1]/10 text-[#5570F1] border border-[#5570F1]/20 rounded-md px-2 py-1">
            الذروة: {DAYS[peak.dow - 1]} · الساعة {peak.hour}:00 ({fmtNumber(peak.count)})
          </span>
        )}
      </div>

      {/* Grid */}
      <div dir="ltr" className="overflow-x-auto">
        <div className="inline-block min-w-full">
          {/* hour header (0–23, Riyadh) */}
          <div className="flex">
            <div className="w-14 shrink-0" />
            {Array.from({ length: 24 }, (_, h) => (
              <div key={h} className="w-6 mx-[2px] text-[9px] text-center text-gray-400">
                {h % 3 === 0 ? h : ""}
              </div>
            ))}
          </div>
          {Array.from({ length: 7 }, (_, row) => {
            const dow = row + 1;
            return (
              <div key={dow} className="flex items-center">
                <div className="w-14 shrink-0 text-[11px] text-gray-600 pe-1 text-right">{DAYS[row]}</div>
                {Array.from({ length: 24 }, (_, h) => {
                  const c = lookup.get(`${dow}-${h}`) || 0;
                  const opacity = c === 0 ? 0 : 0.15 + 0.85 * (c / maxVal);
                  return (
                    <div
                      key={h}
                      aria-label={`${DAYS[row]} ${h}:00 — ${fmtNumber(c)}${valueNoun ? ` ${valueNoun}` : ""}`}
                      onMouseEnter={(e) => {
                        const r = e.currentTarget.getBoundingClientRect();
                        setHover({ dow, hour: h, count: c, x: r.left + r.width / 2, y: r.top });
                      }}
                      onMouseLeave={() => setHover(null)}
                      className="size-6 m-[2px] rounded-sm border border-gray-100 cursor-default transition-transform hover:scale-125 hover:ring-2 hover:ring-[#5570F1]/40"
                      style={{ backgroundColor: c === 0 ? "#f3f4f6" : `rgba(85,112,241,${opacity})` }}
                    />
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* Color legend */}
      <div className="flex items-center gap-2 mt-3 text-xs text-gray-500">
        <span>أقل</span>
        <div className="flex gap-[2px]">
          {LEGEND_STEPS.map((s) => (
            <div
              key={s}
              className="size-4 rounded-sm border border-gray-100"
              style={{ backgroundColor: `rgba(85,112,241,${s})` }}
            />
          ))}
        </div>
        <span>أكثر</span>
        <span className="ms-1 text-gray-400">(الأعلى = {fmtNumber(maxVal)})</span>
      </div>

      {/* Styled hover tooltip (positioned above the hovered cell) */}
      {hover && (
        <div
          className="fixed z-50 pointer-events-none -translate-x-1/2 -translate-y-full"
          style={{ left: hover.x, top: hover.y - 8 }}
        >
          <div dir="rtl" className="rounded-lg bg-gray-900 text-white shadow-xl px-3 py-2 text-xs whitespace-nowrap">
            <div className="font-medium">
              {DAYS[hover.dow - 1]} · {String(hover.hour).padStart(2, "0")}:00–{String(hover.hour + 1).padStart(2, "0")}:00
            </div>
            <div className="flex items-center gap-1.5 mt-1">
              <span
                className="size-2 rounded-full"
                style={{
                  backgroundColor: hover.count === 0 ? "#6b7280" : `rgba(120,140,255,${0.4 + 0.6 * (hover.count / maxVal)})`,
                }}
              />
              <span className="font-bold">{fmtNumber(hover.count)}</span>
              <span className="text-gray-300">{valueNoun || metricLabel}</span>
            </div>
          </div>
          <div className="absolute left-1/2 top-full -mt-px h-0 w-0 -translate-x-1/2 border-x-4 border-x-transparent border-t-4 border-t-gray-900" />
        </div>
      )}
    </div>
  );
}
