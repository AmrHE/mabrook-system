"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toCsv, downloadCsv, type CsvColumn } from "@/utils/export/toCsv";

interface ExportButtonProps<T extends Record<string, unknown>> {
  rows: T[];
  columns: CsvColumn<T>[];
  /** Output file name, e.g. "moms.csv". */
  filename: string;
  label?: string;
  className?: string;
  disabled?: boolean;
}

/** Small client button that exports the given rows to a CSV download. */
export default function ExportButton<T extends Record<string, unknown>>({
  rows,
  columns,
  filename,
  label = "تصدير CSV",
  className,
  disabled,
}: ExportButtonProps<T>) {
  const isEmpty = !rows || rows.length === 0;

  const handleExport = () => {
    if (isEmpty) return;
    downloadCsv(filename, toCsv(columns, rows));
  };

  return (
    <Button
      type="button"
      variant="outline"
      onClick={handleExport}
      disabled={disabled || isEmpty}
      className={className}
    >
      <Download className="size-4" />
      {label}
    </Button>
  );
}
