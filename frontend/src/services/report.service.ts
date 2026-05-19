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
  /** Ordered list of column keys. Empty/omitted → server default for the type. */
  columnKeys?: string[];
  /** When set, server resolves columns/filters from this template first. */
  templateId?: string;
  /** Override the generated file's display name in History. */
  reportName?: string;
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

// ──────────────────────────────────────────────
//  Column registry
// ──────────────────────────────────────────────

export interface ColumnDef {
  key: string;
  header: string;
  width: number;
  group: string;
}

export interface ReportTypeColumnInfo {
  reportType: string;
  source: "candidate" | "attendance" | "leave" | "payment" | "employee_perf";
  defaultKeys: string[];
  columns: ColumnDef[];
}

export async function getColumnRegistry(reportType?: string): Promise<ReportTypeColumnInfo[]> {
  const res = await api.get("/reports/columns", reportType ? { params: { reportType } } : {});
  const payload = res.data as { data: ReportTypeColumnInfo | ReportTypeColumnInfo[] };
  return Array.isArray(payload.data) ? payload.data : [payload.data];
}

// ──────────────────────────────────────────────
//  Templates
// ──────────────────────────────────────────────

export interface ReportTemplate {
  id: string;
  name: string;
  reportType: string;
  columnConfig: string[];
  filters: Record<string, unknown> | null;
  description: string | null;
  isShared: boolean;
  createdById: string;
  createdByName: string | null;
  createdAt: string;
  updatedAt: string;
  usageCount: number;
}

export interface SaveTemplateInput {
  name: string;
  reportType: string;
  columnKeys: string[];
  filters?: Record<string, unknown> | null;
  description?: string | null;
  isShared?: boolean;
}

export async function listTemplates(reportType?: string): Promise<ReportTemplate[]> {
  const res = await api.get("/reports/templates", reportType ? { params: { reportType } } : {});
  return (res.data as { data: ReportTemplate[] }).data;
}

export async function createTemplate(input: SaveTemplateInput): Promise<ReportTemplate> {
  const res = await api.post("/reports/templates", input);
  return (res.data as { data: ReportTemplate }).data;
}

export async function updateTemplate(
  id: string,
  input: Partial<SaveTemplateInput>,
): Promise<ReportTemplate> {
  const res = await api.patch(`/reports/templates/${id}`, input);
  return (res.data as { data: ReportTemplate }).data;
}

export async function deleteTemplate(id: string): Promise<void> {
  await api.delete(`/reports/templates/${id}`);
}

// ──────────────────────────────────────────────
//  Scheduled reports (extended payloads)
// ──────────────────────────────────────────────

export interface ScheduledReport {
  id: string;
  reportType: string;
  reportName: string;
  filters: Record<string, string> | null;
  columnConfig: string[] | null;
  templateId: string | null;
  templateName: string | null;
  frequency: string;
  time: string;
  recipients: string[];
  lastSent: string | null;
  nextScheduled: string;
  status: "active" | "paused";
}

export interface CreateScheduleInput {
  reportType: string;
  reportName: string;
  frequency: string;
  time: string;
  recipients: string[];
  filters?: Record<string, string>;
  columnKeys?: string[];
  templateId?: string;
}

export type UpdateScheduleInput = Partial<{
  status: string;
  reportType: string;
  reportName: string;
  frequency: string;
  time: string;
  recipients: string[];
  filters: Record<string, string>;
  columnKeys: string[] | null;
  templateId: string | null;
}>;
