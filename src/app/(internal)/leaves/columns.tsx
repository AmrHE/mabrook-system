"use client";

import type { ColumnDef } from "@tanstack/react-table";
import LeaveStatusBadge, { LeavePayModeBadge } from "@/components/LeaveStatusBadge";

/**
 * Flat row shape for the leaves table. Every display string is precomputed on the
 * server (see page.tsx) so the filters and the CSV export can work on plain string
 * equality, matching the convention in the moms/visits tables.
 *
 * This file is a client component because the status/pay-mode cells render badges
 * — cell renderers are functions and can't cross the RSC boundary.
 */
export type LeaveRow = {
  id: string;
  employee: string;
  role: string;
  typeLabel: string;
  span: string;
  daysCount: number;
  duration: string;
  status: string;
  statusLabel: string;
  /** Raw enum — drives the badge and the facet filter. */
  payMode: string;
  /** Arabic — what the CSV exports. */
  payModeLabel: string;
  reason: string;
  decidedByName: string;
  createdAtLabel: string;
};

export const columns: ColumnDef<LeaveRow>[] = [
  { accessorKey: "employee", header: "مقدّم الطلب" },
  { accessorKey: "role", header: "الدور" },
  { accessorKey: "typeLabel", header: "النوع" },
  { accessorKey: "span", header: "التاريخ" },
  { accessorKey: "daysCount", header: "عدد الأيام" },
  { accessorKey: "duration", header: "المدة" },
  {
    accessorKey: "statusLabel",
    header: "الحالة",
    cell: ({ row }) => <LeaveStatusBadge status={row.original.status} />,
  },
  {
    accessorKey: "payMode",
    header: "مدفوع؟",
    cell: ({ row }) => <LeavePayModeBadge payMode={row.original.payMode} />,
  },
  { accessorKey: "decidedByName", header: "تم القرار بواسطة" },
  { accessorKey: "createdAtLabel", header: "تاريخ الطلب" },
];
