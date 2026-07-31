/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/app/(internal)/visits/data-table";
import { Skeleton } from "@/components/ui/skeleton";
import LeaveStatusBadge, { LeavePayModeBadge } from "@/components/LeaveStatusBadge";
import { leaveStatus } from "@/models/enum.constants";
import { formatLeaveSpan, formatPermitMinutes, leaveTypeLabel } from "@/utils/leave/labels";
import { TIMEZONE } from "@/utils/date/range";

const fmtDT = (d: any) =>
  d ? new Date(d).toLocaleString("en-SA", { timeZone: TIMEZONE, dateStyle: "short", timeStyle: "short" }) : "—";

const columns: ColumnDef<any>[] = [
  { accessorKey: "typeLabel", header: "النوع" },
  { accessorKey: "span", header: "التاريخ" },
  { accessorKey: "daysCount", header: "أيام" },
  { accessorKey: "duration", header: "المدة" },
  {
    accessorKey: "status",
    header: "الحالة",
    cell: ({ row }) => <LeaveStatusBadge status={row.original.status} />,
  },
  {
    accessorKey: "payMode",
    header: "مدفوع؟",
    cell: ({ row }) => <LeavePayModeBadge payMode={row.original.payMode} />,
  },
  { accessorKey: "reason", header: "السبب" },
  { accessorKey: "decidedByName", header: "تم القرار بواسطة" },
  { accessorKey: "createdAtLabel", header: "تاريخ الطلب" },
];

/** One employee's leave history, sourced from the role-scoped leave list endpoint. */
export default function EmployeeLeavesTable({ userToken, employeeId }: { userToken?: string; employeeId: string }) {
  const router = useRouter();
  const [rows, setRows] = useState<any[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/leave/get-requests?userId=${employeeId}`, { headers: { authorization: `Bearer ${userToken}` } })
      .then((r) => {
        if (!r.ok) throw new Error(`فشل التحميل (${r.status})`);
        return r.json();
      })
      .then((j) => {
        if (cancelled) return;
        setRows(
          (j.leaves || []).map((l: any) => ({
            id: l._id,
            typeLabel: leaveTypeLabel(l.type),
            span: formatLeaveSpan(l.startDay, l.endDay),
            daysCount: l.daysCount ?? 1,
            duration: formatPermitMinutes(l.minutes),
            status: l.status,
            payMode: l.status === leaveStatus.APPROVED ? l.payMode ?? "" : "",
            reason: l.reason ?? "",
            decidedByName: l.decidedBy
              ? `${l.decidedBy.firstName ?? ""} ${l.decidedBy.lastName ?? ""}`.trim()
              : "",
            createdAtLabel: fmtDT(l.createdAt),
          })),
        );
      })
      .catch((e) => !cancelled && setError(e?.message || "تعذّر تحميل الطلبات"));
    return () => {
      cancelled = true;
    };
  }, [userToken, employeeId]);

  if (error) return <div className="rounded-lg bg-red-50 text-red-700 px-4 py-3 text-sm">{error}</div>;
  if (!rows) return <Skeleton className="w-full h-[300px]" />;

  return (
    <div className="overflow-x-auto">
      <DataTable columns={columns} data={rows} onRowClick={(row: any) => router.push(`/leaves/${row.id}`)} />
    </div>
  );
}
