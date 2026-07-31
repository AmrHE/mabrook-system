"use client";

import { useMemo } from "react";
import { fmtNumber } from "./constants";
import { NoData } from "./NoData";

type Axis = { id: string; name: string };
type Cell = { rowId: string; colId: string; value: number };

/**
 * Generic two-dimension heat table (rows × cols) with color-intensity cells.
 * Used for "box × employee" and "remaining stock per hospital × box". Columns
 * are capped so the grid stays readable; the drop is reported explicitly.
 */
export default function MatrixHeatTable({
  rows,
  cols,
  cells,
  rowHeader = "",
  valueNoun = "",
  maxCols = 12,
  maxRows = 15,
}: {
  rows: Axis[];
  cols: Axis[];
  cells: Cell[];
  rowHeader?: string;
  valueNoun?: string;
  maxCols?: number;
  maxRows?: number;
}) {
  const { shownRows, shownCols, lookup, max, hiddenCols, hiddenRows } = useMemo(() => {
    const shownCols = (cols || []).slice(0, maxCols);
    const shownRows = (rows || []).slice(0, maxRows);
    const colSet = new Set(shownCols.map((c) => c.id));
    const rowSet = new Set(shownRows.map((r) => r.id));
    const lookup = new Map<string, number>();
    let max = 0;
    for (const c of cells || []) {
      if (!colSet.has(c.colId) || !rowSet.has(c.rowId)) continue;
      lookup.set(`${c.rowId}|${c.colId}`, c.value);
      if (c.value > max) max = c.value;
    }
    return {
      shownRows,
      shownCols,
      lookup,
      max,
      hiddenCols: Math.max(0, (cols || []).length - shownCols.length),
      hiddenRows: Math.max(0, (rows || []).length - shownRows.length),
    };
  }, [rows, cols, cells, maxCols, maxRows]);

  if (!rows?.length || !cols?.length) return <NoData />;
  const maxVal = max || 1;

  return (
    <div>
      <div dir="ltr" className="overflow-x-auto">
        <table className="border-collapse text-xs">
          <thead>
            <tr>
              <th className="sticky start-0 bg-white z-10 p-2 text-start text-gray-500 font-medium">{rowHeader}</th>
              {shownCols.map((c) => (
                <th key={c.id} className="p-2 text-center text-gray-500 font-medium align-bottom">
                  <div className="max-w-[90px] truncate mx-auto" title={c.name}>{c.name}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shownRows.map((r) => (
              <tr key={r.id}>
                <td className="sticky start-0 bg-white z-10 p-2 text-start text-gray-700 whitespace-nowrap max-w-[160px] truncate" title={r.name}>
                  {r.name}
                </td>
                {shownCols.map((c) => {
                  const v = lookup.get(`${r.id}|${c.id}`) || 0;
                  const opacity = v <= 0 ? 0 : 0.15 + 0.85 * (v / maxVal);
                  return (
                    <td key={c.id} className="p-1 text-center">
                      <div
                        title={`${r.name} · ${c.name}: ${fmtNumber(v)}${valueNoun ? ` ${valueNoun}` : ""}`}
                        className="rounded-md py-1.5 px-2 min-w-[38px] border border-gray-100"
                        style={{
                          backgroundColor: v <= 0 ? "#f3f4f6" : `rgba(85,112,241,${opacity})`,
                          color: opacity > 0.55 ? "#fff" : "#374151",
                        }}
                      >
                        {v === 0 ? "—" : fmtNumber(v)}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {(hiddenCols > 0 || hiddenRows > 0) && (
        <p className="text-[11px] text-gray-400 mt-2">
          {hiddenCols > 0 && `عرض أعلى ${shownCols.length} عمود (${hiddenCols} مخفي). `}
          {hiddenRows > 0 && `عرض أعلى ${shownRows.length} صف (${hiddenRows} مخفي).`}
        </p>
      )}
    </div>
  );
}
