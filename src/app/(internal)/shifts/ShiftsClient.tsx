/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/app/(internal)/visits/data-table";
import { Skeleton } from "@/components/ui/skeleton";
import DateRangeFilter, { type ResolvedRange } from "@/components/DateRangeFilter";
import ExportButton from "@/components/ExportButton";
import FacetFilterBar, { applyFacetFilters, type FacetColumn, type FacetSelection } from "@/components/FacetFilterBar";
import LocationModal from "@/components/LocationModal";
import SessionsModal from "@/components/SessionsModal";
import type { CsvColumn } from "@/utils/export/toCsv";
import { userRoles } from "@/models/enum.constants";

interface ShiftColumn {
  key: string;
  header: string;
  sortable?: boolean;
  cell?: (row: any) => ReactNode;
  /** Columns/facets that only make sense when viewing everyone's shifts. */
  adminOnly?: boolean;
}

// One row per employee per day. "أول دخول" / "آخر خروج" bracket the day, and
// "ساعات العمل" is the sum of its sessions — so the break between a check-out
// and the next check-in is visible in "الاستراحة" but never paid.
const COLUMNS: ShiftColumn[] = [
  { key: "employee", header: "الموظف", adminOnly: true },
  { key: "email", header: "البريد", adminOnly: true },
  { key: "dayKey", header: "التاريخ" },
  { key: "startTime", header: "أول دخول" },
  { key: "endTime", header: "آخر خروج" },
  { key: "durationHours", header: "ساعات العمل" },
  {
    key: "sessionsCount",
    header: "الجلسات",
    cell: (r) => <SessionsModal sessions={r.sessions} count={r.sessionsCount} />,
  },
  { key: "breakMinutes", header: "الاستراحة (د)" },
  { key: "visitsCount", header: "الزيارات" },
  { key: "momsCount", header: "الأمهات" },
  {
    // Single location column: the modal shows both check-in (green) and check-out (red).
    key: "startLocation",
    header: "الموقع",
    sortable: false,
    cell: (r) => (
      <LocationModal
        start={r.startLoc}
        end={r.endLoc}
        hospital={r.hospitalLoc}
        triggerText={r.startLocation || r.endLocation || undefined}
      />
    ),
  },
  { key: "autoClosed", header: "إغلاق تلقائي" },
  { key: "closeReason", header: "سبب الإغلاق" },
  { key: "staleOpen", header: "متروك مفتوح" },
];

/** Flat sessions text, so the CSV keeps the detail the modal shows. */
const CSV_COLUMNS: CsvColumn<any>[] = [
  ...(COLUMNS.filter((c) => c.key !== "sessionsCount") as CsvColumn<any>[]),
  { key: "sessionsCount", header: "عدد الجلسات" },
  { key: "sessionsText", header: "تفاصيل الجلسات" },
];

const FACETS: (FacetColumn & { adminOnly?: boolean })[] = [
  { key: "employee", label: "الموظف", adminOnly: true },
  { key: "sessionsCount", label: "عدد الجلسات" },
  { key: "autoClosed", label: "إغلاق تلقائي" },
  { key: "closeReason", label: "سبب الإغلاق" },
  { key: "staleOpen", label: "متروك مفتوح" },
];

export default function ShiftsClient({ userToken, userRole }: { userToken?: string; userRole?: string }) {
  const isAdmin = userRole === userRoles.ADMIN;
  const [range, setRange] = useState<ResolvedRange | null>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [selected, setSelected] = useState<FacetSelection>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!range) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const qs = `from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}`;
        const res = await fetch(`/api/analytics/shifts-rows?${qs}`, {
          headers: { authorization: `Bearer ${userToken}` },
        });
        if (!res.ok) throw new Error(`فشل تحميل الورديات (${res.status})`);
        const json = await res.json();
        if (!cancelled) setRows(json.rows || []);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "تعذّر تحميل الورديات");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [range, userToken]);

  // Employees don't need the employee-identifying columns/filters (it's all them).
  const columns = useMemo(() => COLUMNS.filter((c) => isAdmin || !c.adminOnly), [isAdmin]);
  const facets = useMemo(() => FACETS.filter((f) => isAdmin || !f.adminOnly), [isAdmin]);
  const displayedRows = useMemo(() => applyFacetFilters(rows, selected), [rows, selected]);

  const tableCols: ColumnDef<any>[] = useMemo(
    () =>
      columns.map((c) => ({
        accessorKey: c.key,
        header: c.header,
        ...(c.sortable === false ? { enableSorting: false } : {}),
        ...(c.cell ? { cell: ({ row }: { row: { original: any } }) => c.cell!(row.original) } : {}),
      })),
    [columns],
  );

  const busy = loading || !range;

  return (
    <div>
      <div className="flex md:items-center flex-col md:flex-row justify-between mb-6 gap-4">
        <h1 className="font-bold text-3xl">أيام الدوام</h1>
        <DateRangeFilter defaultPreset="6months" onChange={setRange} />
      </div>

      {!busy && !error && facets.length > 0 ? (
        <FacetFilterBar
          rows={rows}
          facets={facets}
          selected={selected}
          onChange={setSelected}
          className="mb-3"
        />
      ) : null}

      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-muted-foreground">
          {busy ? "جارٍ التحميل..." : `${displayedRows.length} من ${rows.length} صف`}
        </p>
        <ExportButton
          rows={displayedRows}
          columns={CSV_COLUMNS.filter((c) => isAdmin || !COLUMNS.find((x) => x.key === c.key)?.adminOnly)}
          filename="shifts.csv"
        />
      </div>

      {error ? (
        <div className="rounded-lg bg-red-50 text-red-700 px-4 py-3 text-sm">{error}</div>
      ) : busy ? (
        <Skeleton className="w-full h-[400px]" />
      ) : (
        <div className="overflow-x-auto">
          <DataTable columns={tableCols} data={displayedRows} />
        </div>
      )}
    </div>
  );
}
