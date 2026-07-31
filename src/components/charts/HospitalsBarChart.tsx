"use client";

import { useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CHART_COLORS, withPercent } from "./constants";
import { NoData } from "./NoData";

type Row = { hospitalId: string; name: string; moms: number; productsDistributed: number; visitsCount: number };

const N = 7;

export default function HospitalsBarChart({ data }: { data: Row[] }) {
  const [mode, setMode] = useState<"top" | "bottom">("top");

  const sorted = [...(data || [])].sort((a, b) => b.moms - a.moms);
  const slice = mode === "top" ? sorted.slice(0, N) : sorted.slice(-N).reverse();
  const chartData = slice.map((r) => ({ name: r.name, moms: r.moms }));
  // Share is of all hospitals' moms, not just the shown top/bottom N.
  const totalMoms = (data || []).reduce((s, r) => s + (r.moms || 0), 0);

  return (
    <div>
      <div className="flex justify-end gap-1 mb-3">
        {(["top", "bottom"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`text-xs px-3 py-1 rounded-md transition-colors cursor-pointer ${
              mode === m ? "bg-[#5570F1] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {m === "top" ? "الأعلى" : "الأدنى"}
          </button>
        ))}
      </div>
      <div dir="ltr" style={{ width: "100%", height: 300 }}>
        {chartData.length === 0 ? (
          <NoData />
        ) : (
          <ResponsiveContainer>
            <BarChart layout="vertical" data={chartData} margin={{ top: 5, right: 24, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 12 }} allowDecimals={false} />
              <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
              <Tooltip formatter={withPercent(totalMoms)} />
              <Bar dataKey="moms" name="الأمهات" fill={CHART_COLORS.primary} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
