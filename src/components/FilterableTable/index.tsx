/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/app/(internal)/visits/data-table";
import ExportButton from "@/components/ExportButton";
import type { CsvColumn } from "@/utils/export/toCsv";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/** A declarative, serialisable filter: matches `row[key]` (as text) === selected option value. */
export interface TableFilter {
  key: string;
  label: string;
  options: { label: string; value: string }[];
}

const ALL = "__all__";

interface FilterableTableProps<T extends Record<string, any>> {
  data: T[];
  columns: ColumnDef<any, any>[];
  exportColumns: CsvColumn<T>[];
  filename: string;
  /** Row-click navigation base, e.g. "/moms" → pushes `/moms/{id}`. */
  basePath?: string;
  filters?: TableFilter[];
  searchKeys?: string[];
  searchPlaceholder?: string;
}

/**
 * Generic client table with a consistent toolbar: optional text search, any
 * number of select filters, a live "filtered / total" count, and a CSV export
 * that always reflects the *currently filtered* rows.
 */
export default function FilterableTable<T extends Record<string, any>>({
  data,
  columns,
  exportColumns,
  filename,
  basePath,
  filters = [],
  searchKeys = [],
  searchPlaceholder = "بحث...",
}: FilterableTableProps<T>) {
  const router = useRouter();
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    let rows = data || [];
    for (const f of filters) {
      const val = selected[f.key];
      if (val && val !== ALL) {
        rows = rows.filter((r) => String(r[f.key] ?? "") === val);
      }
    }
    const q = search.trim().toLowerCase();
    if (q && searchKeys.length) {
      rows = rows.filter((r) => searchKeys.some((k) => String(r[k] ?? "").toLowerCase().includes(q)));
    }
    return rows;
  }, [data, filters, selected, search, searchKeys]);

  const handleRowClick = (row: T) => {
    if (basePath && row.id) router.push(`${basePath}/${row.id}`);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center gap-3 justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {searchKeys.length > 0 && (
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-[200px] bg-white"
            />
          )}
          {filters.map((f) => (
            <Select
              key={f.key}
              value={selected[f.key] ?? ALL}
              onValueChange={(v) => setSelected((s) => ({ ...s, [f.key]: v }))}
            >
              <SelectTrigger className="w-[180px] bg-white">
                <SelectValue placeholder={f.label} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{`${f.label}: الكل`}</SelectItem>
                {f.options.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ))}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-sm text-muted-foreground">
            {filtered.length} / {(data || []).length}
          </span>
          <ExportButton rows={filtered} columns={exportColumns} filename={filename} />
        </div>
      </div>
      <DataTable columns={columns as ColumnDef<T, any>[]} data={filtered} onRowClick={basePath ? handleRowClick : undefined} />
    </div>
  );
}
