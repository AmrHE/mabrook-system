/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import type { CsvColumn } from "@/utils/export/toCsv";
import FilterableTable from "@/components/FilterableTable";
import LocationModal from "@/components/LocationModal";

export interface HospitalRow {
  id: string;
  name: string;
  city: string;
  district: string;
  /** Comma-joined names of employees assigned to this hospital ("—" when none). */
  assignedEmployeesText: string;
  /** Hospital anchor coords for the map modal (null when not set). */
  location: { lat: number; lng: number } | null;
  /** "lat, lng" string for CSV export. */
  locationText: string;
  [key: string]: any;
}

/**
 * Hospitals table (main /hospitals page). Owns its column defs client-side so the
 * location column can render a LocationModal cell (a function can't cross the
 * Server→Client boundary). Mirrors VisitsTable. Row click → /hospitals/{id}.
 */
export default function HospitalsTable({ data }: { data: HospitalRow[] }) {
  const cityOptions = useMemo(
    () =>
      Array.from(new Set(data.map((h) => h.city).filter(Boolean))).map((city) => ({ label: city, value: city })),
    [data],
  );

  const columns: ColumnDef<any, any>[] = [
    { accessorKey: "name", header: "اسم المستشفى" },
    { accessorKey: "city", header: "المدينة" },
    { accessorKey: "district", header: "الحي" },
    { accessorKey: "assignedEmployeesText", header: "الموظفون المعينون" },
    {
      id: "location",
      header: "الموقع",
      enableSorting: false,
      cell: ({ row }: any) =>
        row.original.location ? (
          <LocationModal start={row.original.location} title="موقع المستشفى" startLabel="المستشفى" triggerText="عرض على الخريطة" />
        ) : (
          <span className="text-amber-600">غير محدد</span>
        ),
    },
  ];

  const exportColumns: CsvColumn<any>[] = [
    { key: "name", header: "اسم المستشفى" },
    { key: "city", header: "المدينة" },
    { key: "district", header: "الحي" },
    { key: "assignedEmployeesText", header: "الموظفون المعينون" },
    { key: "locationText", header: "الموقع" },
  ];

  return (
    <FilterableTable
      data={data}
      columns={columns}
      basePath="/hospitals"
      filename="hospitals.csv"
      searchKeys={["name", "city", "district", "assignedEmployeesText"]}
      searchPlaceholder="ابحث بالاسم أو المدينة أو الموظف"
      filters={cityOptions.length > 1 ? [{ key: "city", label: "المدينة", options: cityOptions }] : []}
      exportColumns={exportColumns}
    />
  );
}
