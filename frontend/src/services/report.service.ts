import { api } from "@/lib/api";

// ──────────────────────────────────────────────
//  Report Generation Service
// ──────────────────────────────────────────────

export interface GenerateReportInput {
  reportType: string;
  filters?: {
    dateFrom?: string;
    dateTo?: string;
    recruiterId?: string;
    companyId?: string;
    serviceProviderId?: string;
    hrManagerId?: string;
    zone?: string;
    status?: string;
    paymentStatus?: string;
    employeeId?: string;
    employeeScope?: string;
  };
}

/** Generate an on-demand report and download as XLSX blob */
export async function generateReport(data: GenerateReportInput): Promise<Blob> {
  const res = await api.post("/reports/generate", data, { responseType: "blob" });
  return res.data as Blob;
}

/** Trigger report download in browser */
export async function downloadReport(data: GenerateReportInput, fileName?: string): Promise<void> {
  const blob = await generateReport(data);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName ?? `${data.reportType}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
