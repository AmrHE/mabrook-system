/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/app/(internal)/visits/data-table";
import { Skeleton } from "@/components/ui/skeleton";
import LocationModal from "@/components/LocationModal";

const CLOSE_REASON_AR: Record<string, string> = {
  MANUAL: "يدوي",
  LOGOUT: "تسجيل خروج",
  MAX_DURATION: "تجاوز المدة",
  INACTIVITY: "خمول",
  DUPLICATE: "مكرر",
};

const fmtDT = (d: any) =>
  d ? new Date(d).toLocaleString("en-SA", { timeZone: "Asia/Riyadh", dateStyle: "short", timeStyle: "short" }) : "—";

const columns: ColumnDef<any>[] = [
  { accessorKey: "start", header: "البداية" },
  { accessorKey: "end", header: "النهاية" },
  { accessorKey: "durationHours", header: "المدة (س)" },
  { accessorKey: "visitsCount", header: "زيارات" },
  { accessorKey: "momsCount", header: "أمهات" },
  { accessorKey: "onTime", header: "الالتزام" },
  {
    accessorKey: "location",
    header: "الموقع",
    cell: ({ row }) => (
      <LocationModal
        start={row.original.startLocation}
        end={row.original.endLocation}
        triggerText={row.original.location || undefined}
      />
    ),
  },
  { accessorKey: "closeReason", header: "سبب الإغلاق" },
];

/** Per-employee shift history, sourced from the admin shifts-detail endpoint. */
export default function EmployeeShiftsTable({ userToken, employeeId }: { userToken?: string; employeeId: string }) {
  const [rows, setRows] = useState<any[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/analytics/shifts-detail?employeeId=${employeeId}`, { headers: { authorization: `Bearer ${userToken}` } })
      .then((r) => {
        if (!r.ok) throw new Error(`فشل التحميل (${r.status})`);
        return r.json();
      })
      .then((j) => {
        if (cancelled) return;
        const data = (j.data || []).map((d: any) => ({
          start: fmtDT(d.startTime),
          end: fmtDT(d.endTime),
          durationHours: d.durationHours ?? "—",
          visitsCount: d.visitsCount ?? 0,
          momsCount: d.momsCount ?? 0,
          onTime: d.onTime ? "في الوقت" : "متأخر",
          startLocation: d.startLocation ?? null,
          endLocation: d.endLocation ?? null,
          location:
            d.startLocation && Number.isFinite(d.startLocation.lat)
              ? `${d.startLocation.lat.toFixed(4)}, ${d.startLocation.lng.toFixed(4)}`
              : "",
          closeReason: d.closeReason ? CLOSE_REASON_AR[d.closeReason] ?? d.closeReason : "",
        }));
        setRows(data);
      })
      .catch((e) => !cancelled && setError(e?.message || "تعذّر تحميل الورديات"));
    return () => {
      cancelled = true;
    };
  }, [userToken, employeeId]);

  if (error) return <div className="rounded-lg bg-red-50 text-red-700 px-4 py-3 text-sm">{error}</div>;
  if (!rows) return <Skeleton className="w-full h-[300px]" />;

  return (
    <div className="overflow-x-auto">
      <DataTable columns={columns} data={rows} />
    </div>
  );
}
