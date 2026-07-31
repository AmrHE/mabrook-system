/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/app/(internal)/visits/data-table";
import { Skeleton } from "@/components/ui/skeleton";
import ExportButton from "@/components/ExportButton";
import type { CsvColumn } from "@/utils/export/toCsv";
import type { DqColumn } from "@/utils/analytics/dataQualityCategories";

interface Props {
  category: string;
  titleAr: string;
  subtitleAr?: string;
  columns: DqColumn[];
  filename: string;
  from?: string;
  to?: string;
  userToken?: string;
}

export default function DataQualityDrilldownClient({
  category,
  titleAr,
  subtitleAr,
  columns,
  filename,
  from,
  to,
  userToken,
}: Props) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const qs = new URLSearchParams({ category });
        if (from) qs.set("from", from);
        if (to) qs.set("to", to);
        const res = await fetch(`/api/analytics/data-quality/rows?${qs}`, {
          headers: { authorization: `Bearer ${userToken}` },
        });
        if (!res.ok) throw new Error(`فشل تحميل البيانات (${res.status})`);
        const json = await res.json();
        if (!cancelled) setRows(json.rows || []);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "تعذّر تحميل البيانات");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [category, from, to, userToken]);

  const cols: ColumnDef<any>[] = columns.map((c) => ({ accessorKey: c.key, header: c.header }));

  return (
    <div>
      <div className="flex md:items-center flex-col md:flex-row justify-between mb-6 gap-4">
        <div>
          <Link
            href="/analytics"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-2"
          >
            <ArrowRight className="size-4" />
            رجوع إلى التحليلات
          </Link>
          <h1 className="font-bold text-3xl">{titleAr}</h1>
          {subtitleAr && <p className="text-sm text-muted-foreground mt-1">{subtitleAr}</p>}
        </div>
      </div>

      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-muted-foreground">{loading ? "جارٍ التحميل..." : `${rows.length} صف`}</p>
        <ExportButton rows={rows} columns={columns as CsvColumn<any>[]} filename={filename} />
      </div>

      {error ? (
        <div className="rounded-lg bg-red-50 text-red-700 px-4 py-3 text-sm">{error}</div>
      ) : loading ? (
        <Skeleton className="w-full h-[400px]" />
      ) : (
        <div className="overflow-x-auto">
          <DataTable columns={cols} data={rows} />
        </div>
      )}
    </div>
  );
}
