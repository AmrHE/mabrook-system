"use client";

import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { PIE_PALETTE, withPercent } from "./constants";
import { NoData } from "./NoData";

export default function NationalityPieChart({
  data,
}: {
  data: { saudi: number; nonSaudi: number; unknown: number };
}) {
  const slices = [
    { name: "سعودية", value: data?.saudi || 0 },
    { name: "غير سعودية", value: data?.nonSaudi || 0 },
    { name: "غير محدد", value: data?.unknown || 0 },
  ].filter((s) => s.value > 0);

  const total = slices.reduce((acc, s) => acc + s.value, 0);

  return (
    <div dir="ltr" style={{ width: "100%", height: 300 }}>
      {total === 0 ? (
        <NoData />
      ) : (
        <ResponsiveContainer>
          <PieChart>
            <Pie data={slices} dataKey="value" nameKey="name" innerRadius={55} outerRadius={95} paddingAngle={2}>
              {slices.map((_, i) => (
                <Cell key={i} fill={PIE_PALETTE[i % PIE_PALETTE.length]} />
              ))}
            </Pie>
            <Tooltip formatter={withPercent(total)} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
