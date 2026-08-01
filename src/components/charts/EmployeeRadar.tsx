"use client";

import {
  Legend,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { CHART_COLORS, PIE_PALETTE } from "./constants";
import { NoData } from "./NoData";

const METRICS = [
  { key: "moms", label: "الأمهات" },
  { key: "visits", label: "الزيارات" },
  { key: "totalHours", label: "الساعات" },
  { key: "workingDays", label: "أيام العمل" },
  { key: "avgMomsPerDay", label: "معدل/يوم" },
  { key: "attendanceRate", label: "% الحضور" },
  { key: "punctualityRate", label: "% الالتزام بالوقت" },
];

/**
 * Normalised (0–100) multi-KPI profile: the top (or bottom) `count` performers
 * vs. the team average. Every axis is normalised to its own max across the
 * employees who actually worked in the range, so the two variants share one
 * scale and the average line is comparable between them.
 *
 * Output *and* adherence both count: `attendanceRate` and `punctualityRate` come
 * from the employees report, which measures them against the org schedule with
 * approved leave and delay permits already discounted. So an employee who took
 * authorised time off isn't penalised, while one who simply shows up late is —
 * raw volume alone can no longer carry someone to the top of the ranking.
 */
export default function EmployeeRadar({
  data,
  range = null,
  variant = "top",
  count = 3,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any[];
  range?: { from: string; to: string } | null;
  variant?: "top" | "bottom";
  count?: number;
}) {
  const all = data || [];
  // Only evaluate employees who joined early enough to have a fair run at the
  // period: created before the first 20% of the window elapsed (i.e. present
  // for ≥80% of it). Late hires would otherwise skew the ranking/average.
  const cutoff = range
    ? new Date(range.from).getTime() + 0.2 * (new Date(range.to).getTime() - new Date(range.from).getTime())
    : Infinity;
  // …and who actually worked in the range — idle (all-zero) rows would drag the
  // team average toward the centre.
  const active = all.filter(
    (r) =>
      ((r.moms || 0) > 0 || (r.visits || 0) > 0 || (r.workingDays || 0) > 0) &&
      (!r.createdAt || new Date(r.createdAt).getTime() <= cutoff),
  );
  if (active.length === 0) return <NoData />;

  // Per-metric max (shared scale for both variants) and team average.
  const maxByKey: Record<string, number> = {};
  const avgByKey: Record<string, number> = {};
  for (const m of METRICS) {
    maxByKey[m.key] = Math.max(1, ...active.map((r) => r[m.key] || 0));
    avgByKey[m.key] = active.reduce((s, r) => s + (r[m.key] || 0), 0) / active.length;
  }

  // Rank by overall normalised score across all metrics (not moms alone).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const score = (r: any) => METRICS.reduce((s, m) => s + (r[m.key] || 0) / maxByKey[m.key], 0);
  const ranked = [...active].sort((a, b) => score(b) - score(a));
  // Both variants keep best-first order, so the rank prefix (1, 2, 3) always
  // reads highest-performer → lowest within the shown group.
  const selected = variant === "top" ? ranked.slice(0, count) : ranked.slice(-count);

  const chart = METRICS.map((m) => {
    const max = maxByKey[m.key];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const point: Record<string, any> = {
      metric: m.label,
      avg: Math.round((avgByKey[m.key] / max) * 100),
    };
    selected.forEach((e, i) => {
      point[`e${i}`] = Math.round(((e[m.key] || 0) / max) * 100);
    });
    return point;
  });

  return (
    <div dir="ltr" style={{ width: "100%", height: 300 }}>
      <ResponsiveContainer>
        <RadarChart data={chart} outerRadius="70%">
          <PolarGrid />
          <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11 }} />
          <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 9 }} />
          <Radar name="المتوسط" dataKey="avg" stroke={CHART_COLORS.slate} strokeDasharray="4 4" fill="none" />
          {selected.map((e, i) => {
            const color = PIE_PALETTE[i % PIE_PALETTE.length];
            return (
              <Radar
                key={i}
                name={`${i + 1}. ${e.name || "موظف"}`}
                dataKey={`e${i}`}
                stroke={color}
                fill={color}
                fillOpacity={0.1}
              />
            );
          })}
          <Legend />
          <Tooltip />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
