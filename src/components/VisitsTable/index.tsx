/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import type { ColumnDef } from "@tanstack/react-table";
import type { CsvColumn } from "@/utils/export/toCsv";
import FilterableTable from "@/components/FilterableTable";
import LocationModal from "@/components/LocationModal";
import FenceBadge from "@/components/FenceBadge";

export interface VisitRow {
  id: string;
  hospitalName: string;
  city: string;
  district: string;
  momsCount: number;
  employeeName?: string;
  statusLabel: string;
  /** Raw coords for the map modal. */
  startLoc: { lat: number; lng: number } | null;
  endLoc: { lat: number; lng: number } | null;
  /** Hospital anchor coords (for the map modal). */
  hospitalLoc?: { lat: number; lng: number } | null;
  /** "lat, lng" display/CSV strings. */
  startLocationText: string;
  endLocationText: string;
  /** Geofence classification of the visit check-in. */
  fenceStatus?: string;
  fenceDistance?: number | null;
  /** Arabic label for CSV export of the fence status. */
  fenceLabel?: string;
  [key: string]: any;
}

/**
 * Shared visits table (main /visits page + the employee detail "visits" tab).
 * Owns the column defs client-side because the location column renders a
 * LocationModal cell (a function), which can't be passed from a Server
 * Component. Row click navigates to /visits/{id}; the location modal shows the
 * visit's start (green) and end (red) points, like the shifts table.
 */
export default function VisitsTable({
  data,
  showEmployee = false,
  filename = "visits.csv",
}: {
  data: VisitRow[];
  showEmployee?: boolean;
  filename?: string;
}) {
  const columns: ColumnDef<any, any>[] = [
    { accessorKey: "hospitalName", header: "اسم المستشفى" },
    { accessorKey: "city", header: "المدينة" },
    { accessorKey: "district", header: "الحي" },
    { accessorKey: "momsCount", header: "عدد الأمهات" },
    ...(showEmployee ? [{ accessorKey: "employeeName", header: "اسم الموظف" }] : []),
    { accessorKey: "statusLabel", header: "حالة الزيارة" },
    {
      id: "fence",
      header: "حالة الموقع",
      enableSorting: false,
      cell: ({ row }: any) => (
        <FenceBadge status={row.original.fenceStatus} distanceMeters={row.original.fenceDistance} />
      ),
    },
    {
      id: "location",
      header: "الموقع",
      enableSorting: false,
      cell: ({ row }: any) => (
        <LocationModal
          start={row.original.startLoc}
          end={row.original.endLoc}
          hospital={row.original.hospitalLoc}
          startLabel="بداية الزيارة"
          endLabel="نهاية الزيارة"
          title="موقع الزيارة"
          triggerText={row.original.startLocationText || row.original.endLocationText || undefined}
        />
      ),
    },
  ];

  const exportColumns: CsvColumn<any>[] = [
    { key: "hospitalName", header: "اسم المستشفى" },
    { key: "city", header: "المدينة" },
    { key: "district", header: "الحي" },
    { key: "momsCount", header: "عدد الأمهات" },
    ...(showEmployee ? [{ key: "employeeName", header: "اسم الموظف" }] : []),
    { key: "statusLabel", header: "حالة الزيارة" },
    { key: "fenceLabel", header: "حالة الموقع" },
    { key: "startLocationText", header: "موقع البدء" },
    { key: "endLocationText", header: "موقع الانتهاء" },
  ];

  return (
    <FilterableTable
      data={data}
      columns={columns}
      basePath="/visits"
      filename={filename}
      searchKeys={showEmployee ? ["hospitalName", "city", "district", "employeeName"] : ["hospitalName", "city", "district"]}
      searchPlaceholder={showEmployee ? "ابحث بالمستشفى أو المدينة أو الموظف" : "ابحث بالمستشفى أو المدينة أو الحي"}
      filters={[
        {
          key: "statusLabel",
          label: "حالة الزيارة",
          options: [
            { label: "جارية", value: "جارية" },
            { label: "منتهية", value: "منتهية" },
          ],
        },
      ]}
      exportColumns={exportColumns}
    />
  );
}
