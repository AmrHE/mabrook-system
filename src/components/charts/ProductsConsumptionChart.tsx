"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CHART_COLORS, withPercent } from "./constants";
import { NoData } from "./NoData";

type Row = { productId: string; name: string; distributed: number; lowStock: boolean };

const N = 8;

export default function ProductsConsumptionChart({ data }: { data: Row[] }) {
  const slice = [...(data || [])]
    .sort((a, b) => b.distributed - a.distributed)
    .slice(0, N)
    .map((r) => ({ name: r.name, distributed: r.distributed, lowStock: r.lowStock }));

  const hasAny = slice.some((s) => s.distributed > 0);
  // Share is of all products' distributed units, not just the shown top N.
  const totalDistributed = (data || []).reduce((s, r) => s + (r.distributed || 0), 0);

  return (
    <div dir="ltr" style={{ width: "100%", height: 300 }}>
      {!hasAny ? (
        <NoData message="لا يوجد استهلاك في هذه الفترة" />
      ) : (
        <ResponsiveContainer>
          <BarChart data={slice} margin={{ top: 10, right: 10, left: 0, bottom: 50 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-30} textAnchor="end" height={60} />
            <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
            <Tooltip formatter={withPercent(totalDistributed)} />
            <Bar dataKey="distributed" name="موزّع" radius={[4, 4, 0, 0]}>
              {slice.map((c, i) => (
                <Cell key={i} fill={c.lowStock ? CHART_COLORS.orange : CHART_COLORS.primary} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
