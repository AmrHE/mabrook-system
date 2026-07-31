"use client";

import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CHART_COLORS, fmtDate, fmtNumber, type Granularity } from "./constants";
import { NoData } from "./NoData";

type Point = { date: string; count: number; newborns: number };

const TOGGLES: { key: Granularity; label: string }[] = [
  { key: "day", label: "يومي" },
  { key: "week", label: "أسبوعي" },
  { key: "month", label: "شهري" },
];

export default function MomsTrendChart({
  data,
  granularity,
  onGranularityChange,
}: {
  data: Point[];
  granularity: Granularity;
  onGranularityChange: (g: Granularity) => void;
}) {
  let running = 0;
  const series = (data || []).map((d) => {
    running += d.count || 0;
    return { label: fmtDate(d.date, granularity), count: d.count || 0, cumulative: running };
  });

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
            <ComposedChart data={series} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="momsFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={CHART_COLORS.primary} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={CHART_COLORS.primary} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
              <Tooltip formatter={(value) => fmtNumber(Number(value))} />
              <Legend />
              <Area
                type="monotone"
                dataKey="count"
                name="الأمهات"
                stroke={CHART_COLORS.primary}
                fill="url(#momsFill)"
                strokeWidth={2}
              />
              <Line
                type="monotone"
                dataKey="cumulative"
                name="إجمالي تراكمي"
                stroke={CHART_COLORS.green}
                strokeWidth={2}
                dot={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
