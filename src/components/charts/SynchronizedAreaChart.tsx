"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fmtDate, fmtNumber, type Granularity } from "./constants";
import { NoData } from "./NoData";

type Series = { key: string; label: string; color: string };

const TOGGLES: { key: Granularity; label: string }[] = [
  { key: "day", label: "يومي" },
  { key: "week", label: "أسبوعي" },
  { key: "month", label: "شهري" },
];

/**
 * A stack of small area charts sharing one `syncId`, so hovering any panel moves
 * the cursor across all of them at the same date. Each metric keeps its own
 * y-scale — ideal for comparing overlapping (non-additive) funnel metrics over time.
 */
export default function SynchronizedAreaChart({
  data,
  granularity,
  onGranularityChange,
  series,
  syncId = "sync",
}: {
  data: any[]; // eslint-disable-line @typescript-eslint/no-explicit-any
  granularity: Granularity;
  onGranularityChange: (g: Granularity) => void;
  series: Series[];
  syncId?: string;
}) {
  const rows = (data || []).map((d) => ({ ...d, label: fmtDate(d.date, granularity) }));

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

      {rows.length === 0 ? (
        <NoData />
      ) : (
        <div dir="ltr" className="space-y-1">
          {series.map((s, i) => {
            const last = i === series.length - 1;
            return (
              <div key={s.key}>
                <p className="text-xs text-gray-500 ps-2">{s.label}</p>
                <div style={{ width: "100%", height: last ? 120 : 96 }}>
                  <ResponsiveContainer>
                    <AreaChart data={rows} syncId={syncId} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id={`syncfill-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={s.color} stopOpacity={0.35} />
                          <stop offset="95%" stopColor={s.color} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} hide={!last} />
                      <YAxis tick={{ fontSize: 11 }} width={36} allowDecimals={false} />
                      <Tooltip formatter={(value) => fmtNumber(Number(value))} />
                      <Area
                        type="monotone"
                        dataKey={s.key}
                        name={s.label}
                        stroke={s.color}
                        fill={`url(#syncfill-${s.key})`}
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
