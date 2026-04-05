import * as XLSX from "xlsx";

// ──────────────────────────────────────────────
//  Quick Export — Spec Section 23.14
//  Gap 7: Export data table view as XLSX/CSV
// ──────────────────────────────────────────────

interface ExportColumn<T> {
  header: string;
  accessor: (row: T) => string | number | null | undefined;
}

/**
 * Export data to XLSX file and trigger download.
 */
export function exportToXLSX<T>(data: T[], columns: ExportColumn<T>[], filename: string): void {
  const headers = columns.map((c) => c.header);
  const rows = data.map((row) =>
    columns.map((c) => {
      const val = c.accessor(row);
      return val ?? "";
    }),
  );

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Data");
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

/**
 * Export data to CSV file and trigger download.
 */
export function exportToCSV<T>(data: T[], columns: ExportColumn<T>[], filename: string): void {
  const headers = columns.map((c) => c.header);
  const rows = data.map((row) =>
    columns.map((c) => {
      const val = c.accessor(row);
      const str = String(val ?? "");
      // Escape CSV values with commas or quotes
      if (str.includes(",") || str.includes('"') || str.includes("\n")) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    }),
  );

  const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
