"use client";

import { useMemo } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PIE_PALETTE, fmtDate, fmtNumber, type Granularity } from "./constants";
import { NoData } from "./NoData";

type Point = { date: string; boxId: string; boxName: string; count: number };
type Box = { id: string; name: string; total: number };

const TOGGLES: { key: Granularity; label: string }[] = [
  { key: "day", label: "يومي" },
  { key: "week", label: "أسبوعي" },
  { key: "month", label: "شهري" },
];

const MAX_SERIES = 6;

/** Multi-line trend of boxes distributed over time — one line per (top) box. */
export default function BoxTrendChart({
  points,
  boxes,
  granularity,
  onGranularityChange,
}: {
  points: Point[];
  boxes: Box[];
  granularity: Granularity;
  onGranularityChange: (g: Granularity) => void;
}) {
  const { series, shownBoxes } = useMemo(() => {
    const shownBoxes = (boxes || []).slice(0, MAX_SERIES);
    const allow = new Set(shownBoxes.map((b) => b.id));
    // Pivot long rows → one object per date bucket with a field per box.
    const byDate = new Map<string, Record<string, number | string>>();
    for (const p of points || []) {
      if (!allow.has(String(p.boxId))) continue;
      const key = String(p.date);
      const row = byDate.get(key) || { date: key, label: fmtDate(p.date, granularity) };
      row[String(p.boxId)] = ((row[String(p.boxId)] as number) || 0) + p.count;
      byDate.set(key, row);
    }
    const series = [...byDate.values()].sort(
      (a, b) => new Date(a.date as string).getTime() - new Date(b.date as string).getTime(),
    );
    return { series, shownBoxes };
  }, [points, boxes, granularity]);

  return (
    <div>
      <div className="flex items-center justify-end gap-1 mb-3">
        {TOGGLES.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => onGranularityChange(t.key)}
            className={`text-xs px-3 py-1 rounded-md transition-colors cursor-pointer ${
              granularity === t.key ? "bg-[#5570F1] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div dir="ltr" style={{ width: "100%", height: 300 }}>
        {series.length === 0 ? (
          <NoData />
        ) : (
          <ResponsiveContainer>
            <LineChart data={series} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
              <Tooltip formatter={(value) => fmtNumber(Number(value))} />
              <Legend />
              {shownBoxes.map((b, i) => (
                <Line
                  key={b.id}
                  type="monotone"
                  dataKey={b.id}
                  name={b.name}
                  stroke={PIE_PALETTE[i % PIE_PALETTE.length]}
                  strokeWidth={2}
                  dot={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
