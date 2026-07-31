/**
 * CSV helpers for client-side exports. {@link toCsv} is pure (builds the CSV
 * text); {@link downloadCsv} triggers a browser download with a UTF-8 BOM so
 * Excel renders Arabic correctly.
 */

import { downloadBlob } from "./downloadBlob";

export interface CsvColumn<T> {
  /** Property to read from each row. */
  key: keyof T & string;
  /** Column header text (Arabic-friendly). */
  header: string;
}

function escapeCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text = String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

/** Build a CSV string (CRLF line endings) from columns + rows. Pure. */
export function toCsv<T extends Record<string, unknown>>(columns: CsvColumn<T>[], rows: T[]): string {
  const headerLine = columns.map((c) => escapeCell(c.header)).join(",");
  const dataLines = rows.map((row) => columns.map((c) => escapeCell(row[c.key])).join(","));
  return [headerLine, ...dataLines].join("\r\n");
}

/** Trigger a client-side download of `csv` as `filename` (UTF-8 BOM prefixed). */
export function downloadCsv(filename: string, csv: string): void {
  const BOM = String.fromCharCode(0xfeff); // UTF-8 BOM so Excel renders Arabic
  downloadBlob(filename, new Blob([BOM + csv], { type: "text/csv;charset=utf-8;" }));
}
