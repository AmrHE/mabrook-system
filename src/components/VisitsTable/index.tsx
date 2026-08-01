/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import type { ColumnDef } from "@tanstack/react-table";
import type { CsvColumn } from "@/utils/export/toCsv";
import FilterableTable from "@/components/FilterableTable";
import LocationModal from "@/components/LocationModal";
import FenceBadge from "@/components/FenceBadge";
import LowMomRateBadge from "@/components/LowMomRateBadge";
import VisitNotesModal from "@/components/VisitNotesModal";

export interface VisitRow {
  id: string;
  hospitalName: string;
  city: string;
  district: string;
  momsCount: number;
  employeeName?: string;
  statusLabel: string;
  /** Visit length in hours; null while in progress or when implausible. */
  durationHours?: number | null;
  momsPerHour?: number | null;
  /** null = not judged (in progress, too short, or no baseline yet). */
  lowMomRate?: boolean | null;
  /** "نعم" / "لا" / "" — the plain string the select filter and CSV use. */
  lowMomRateLabel?: string;
  /** Rolling window the verdict was measured against, for the badge tooltip. */
  baselineDays?: number;
  notes?: string;
  notesUpdatedByName?: string;
  notesUpdatedAt?: string | null;
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
  userToken,
}: {
  data: VisitRow[];
  showEmployee?: boolean;
  filename?: string;
  userToken?: string;
}) {
  const columns: ColumnDef<any, any>[] = [
    { accessorKey: "hospitalName", header: "اسم المستشفى" },
    { accessorKey: "city", header: "المدينة" },
    { accessorKey: "district", header: "الحي" },
    { accessorKey: "momsCount", header: "عدد الأمهات" },
    { accessorKey: "durationHours", header: "المدة (ساعات)" },
    {
      id: "momRate",
      header: "الإنتاجية",
      enableSorting: false,
      cell: ({ row }: any) => (
        <LowMomRateBadge
          low={row.original.lowMomRate}
          momsPerHour={row.original.momsPerHour}
          baselineDays={row.original.baselineDays}
        />
      ),
    },
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
    {
      id: "notes",
      header: "ملاحظات",
      enableSorting: false,
      cell: ({ row }: any) => (
        <VisitNotesModal
          visitId={row.original.id}
          initialNotes={row.original.notes}
          updatedByName={row.original.notesUpdatedByName}
          updatedAt={row.original.notesUpdatedAt}
          userToken={userToken}
        />
      ),
    },
  ];

  const exportColumns: CsvColumn<any>[] = [
    { key: "hospitalName", header: "اسم المستشفى" },
    { key: "city", header: "المدينة" },
    { key: "district", header: "الحي" },
    { key: "momsCount", header: "عدد الأمهات" },
    { key: "durationHours", header: "المدة (ساعات)" },
    { key: "momsPerHour", header: "أمهات/ساعة" },
    { key: "lowMomRateLabel", header: "إنتاجية منخفضة" },
    ...(showEmployee ? [{ key: "employeeName", header: "اسم الموظف" }] : []),
    { key: "statusLabel", header: "حالة الزيارة" },
    { key: "fenceLabel", header: "حالة الموقع" },
    { key: "startLocationText", header: "موقع البدء" },
    { key: "endLocationText", header: "موقع الانتهاء" },
    { key: "notes", header: "ملاحظات" },
  ];

  return (
    <FilterableTable
      data={data}
      columns={columns}
      basePath="/visits"
      filename={filename}
      searchKeys={showEmployee ? ["hospitalName", "city", "district", "employeeName", "notes"] : ["hospitalName", "city", "district", "notes"]}
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
        {
          // Unjudged visits carry "" and so match neither option — intended.
          key: "lowMomRateLabel",
          label: "الإنتاجية",
          options: [
            { label: "إنتاجية منخفضة", value: "نعم" },
            { label: "طبيعية", value: "لا" },
          ],
        },
      ]}
      exportColumns={exportColumns}
    />
  );
}
