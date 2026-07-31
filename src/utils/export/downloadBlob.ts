/**
 * Trigger a client-side download of `blob` as `filename` via a synthetic anchor
 * click. Shared by {@link ../export/toCsv.downloadCsv} and the database backup
 * card (which downloads a zip).
 */
export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
