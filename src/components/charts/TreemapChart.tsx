"use client";

import { ResponsiveContainer, Tooltip, Treemap } from "recharts";
import { PIE_PALETTE, withPercent } from "./constants";
import { NoData } from "./NoData";

type Node = { name: string; size: number };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function TreemapCell(props: any) {
  const { x, y, width, height, index, name } = props;
  const fill = PIE_PALETTE[index % PIE_PALETTE.length];
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} style={{ fill, stroke: "#fff", strokeWidth: 2 }} />
      {width > 60 && height > 24 && (
        <text x={x + width / 2} y={y + height / 2} textAnchor="middle" dominantBaseline="middle" fill="#fff" fontSize={12}>
          {name}
        </text>
      )}
    </g>
  );
}

export default function TreemapChart({ data }: { data: Node[] }) {
  const rows = (data || []).filter((d) => d.size > 0);
  const totalSize = rows.reduce((s, r) => s + (r.size || 0), 0);

  return (
    <div dir="ltr" style={{ width: "100%", height: 300 }}>
      {rows.length === 0 ? (
        <NoData />
      ) : (
        <ResponsiveContainer>
          <Treemap data={rows} dataKey="size" content={<TreemapCell />} isAnimationActive={false}>
            <Tooltip formatter={withPercent(totalSize)} />
          </Treemap>
        </ResponsiveContainer>
      )}
    </div>
  );
}
