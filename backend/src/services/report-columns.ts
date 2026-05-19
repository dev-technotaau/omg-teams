import type { ReportType } from "@prisma/client";

// ─────────────────────────────────────────────────────────────
//  Canonical Column Registry — §20 Reports column management
//
//  Single source of truth for every column that can appear in
//  any report (Generate, Schedule, Template, CUSTOM). Every
//  surface — generate endpoint, template CRUD, scheduled worker,
//  frontend column picker — validates against this registry.
//
//  Each report type maps to a "source" (the underlying data
//  query) and has an ordered list of columns drawn from that
//  source's pool. Selecting a column outside the pool throws.
// ─────────────────────────────────────────────────────────────

export type ColumnSource =
  | "candidate"
  | "attendance"
  | "leave"
  | "payment"
  | "employee_perf";

export interface ColumnDef {
  /** Stable key — used in column_config arrays. NEVER rename. */
  key: string;
  /** Display label shown in the XLSX header + the picker UI. */
  header: string;
  /** Default Excel column width. */
  width: number;
  /** Logical group shown in the picker UI to keep long lists scannable. */
  group: string;
}

// ─────────────────────────────────────────────────────────────
//  Candidate-based columns (used by every candidate report
//  type + CUSTOM). Covers every field on CandidateReport plus
//  derived/joined fields (recruiter name, company name, etc.).
//  ~50 columns total — matches the user's "48-50" expectation.
// ─────────────────────────────────────────────────────────────

export const CANDIDATE_COLUMNS: ColumnDef[] = [
  // — Identity & meta —
  { key: "serialNo", header: "Sr No", width: 8, group: "Identity" },
  { key: "candidateName", header: "Candidate Name", width: 22, group: "Identity" },
  { key: "contactNo", header: "Contact No", width: 15, group: "Identity" },
  { key: "emailId", header: "Email", width: 26, group: "Identity" },
  { key: "dateOfBirth", header: "Date of Birth", width: 12, group: "Identity" },

  // — Location —
  { key: "zone", header: "Zone", width: 10, group: "Location" },
  { key: "state", header: "State", width: 14, group: "Location" },
  { key: "location", header: "Location", width: 16, group: "Location" },
  { key: "adminState", header: "Admin State", width: 14, group: "Location" },
  { key: "adminLocation", header: "Admin Location", width: 16, group: "Location" },

  // — Profile —
  { key: "profile", header: "Profile", width: 16, group: "Profile" },
  { key: "experience", header: "Experience (yrs)", width: 12, group: "Profile" },
  { key: "currentDesignation", header: "Designation", width: 18, group: "Profile" },
  { key: "currentOrganization", header: "Organization", width: 22, group: "Profile" },
  { key: "higherQualification", header: "Qualification", width: 18, group: "Profile" },
  { key: "noticePeriod", header: "Notice Period", width: 12, group: "Profile" },

  // — Education detail —
  { key: "diplomaPartFull", header: "Diploma (Part/Full)", width: 14, group: "Education" },
  { key: "graduationPercent", header: "Grad %", width: 8, group: "Education" },
  { key: "graduationYear", header: "Grad Year", width: 10, group: "Education" },
  { key: "twelfthPercent", header: "12th %", width: 8, group: "Education" },
  { key: "twelfthPassingYear", header: "12th Year", width: 10, group: "Education" },
  { key: "tenthPercent", header: "10th %", width: 8, group: "Education" },
  { key: "tenthPassingYear", header: "10th Year", width: 10, group: "Education" },

  // — Compensation —
  { key: "currentCtc", header: "Current CTC", width: 12, group: "Compensation" },
  { key: "expectedCtc", header: "Expected CTC", width: 12, group: "Compensation" },

  // — Pipeline —
  { key: "status", header: "Status", width: 12, group: "Pipeline" },
  { key: "stage", header: "Stage", width: 16, group: "Pipeline" },
  { key: "isDuplicate", header: "Duplicate", width: 10, group: "Pipeline" },
  { key: "dateSourced", header: "Date Sourced", width: 12, group: "Pipeline" },
  { key: "cvSharedOnDate", header: "CV Shared On", width: 12, group: "Pipeline" },
  { key: "dateOfJoining", header: "DOJ", width: 12, group: "Pipeline" },
  { key: "remarks", header: "Remarks", width: 26, group: "Pipeline" },

  // — Set-A (West/Central) checkpoints —
  { key: "isCtcInformed", header: "CTC Informed", width: 12, group: "Set A Checks" },
  { key: "isOffRollOkay", header: "Off-Roll OK", width: 12, group: "Set A Checks" },
  { key: "isOnRollExplained", header: "On-Roll Explained", width: 14, group: "Set A Checks" },
  { key: "hasTwoWheeler", header: "Two-Wheeler", width: 12, group: "Set A Checks" },
  { key: "communicationSkill", header: "Comm Skill (1-10)", width: 12, group: "Set A Checks" },

  // — Stakeholders —
  { key: "recruiterName", header: "Recruiter", width: 22, group: "Stakeholders" },
  { key: "company", header: "Company", width: 22, group: "Stakeholders" },
  { key: "serviceProvider", header: "Service Provider", width: 22, group: "Stakeholders" },
  { key: "hrManager", header: "HR Manager", width: 22, group: "Stakeholders" },
  { key: "hrFeedback", header: "HR Feedback", width: 14, group: "Stakeholders" },

  // — Billing —
  { key: "invoiceNumber", header: "Invoice No", width: 15, group: "Billing" },
  { key: "invoiceDate", header: "Invoice Date", width: 12, group: "Billing" },
  { key: "invoiceAmount", header: "Invoice Amount", width: 14, group: "Billing" },
  { key: "gstAmount", header: "GST", width: 10, group: "Billing" },
  { key: "tdsAmount", header: "TDS", width: 10, group: "Billing" },
  { key: "amountReceived", header: "Amount Received", width: 14, group: "Billing" },
  { key: "paymentStatus", header: "Payment Status", width: 14, group: "Billing" },
  { key: "paymentDate", header: "Payment Date", width: 12, group: "Billing" },

  // — Audit —
  { key: "createdAt", header: "Created On", width: 12, group: "Audit" },
];

export const ATTENDANCE_COLUMNS: ColumnDef[] = [
  { key: "date", header: "Date", width: 12, group: "Attendance" },
  { key: "employee", header: "Employee", width: 22, group: "Attendance" },
  { key: "employeeId", header: "Employee ID", width: 14, group: "Attendance" },
  { key: "email", header: "Email", width: 26, group: "Attendance" },
  { key: "punchIn", header: "Punch In", width: 12, group: "Attendance" },
  { key: "punchOut", header: "Punch Out", width: 12, group: "Attendance" },
  { key: "workingHours", header: "Working Hours", width: 14, group: "Attendance" },
  { key: "status", header: "Status", width: 14, group: "Attendance" },
  { key: "isLate", header: "Late", width: 8, group: "Attendance" },
  { key: "lateByMinutes", header: "Late By (min)", width: 12, group: "Attendance" },
];

export const LEAVE_COLUMNS: ColumnDef[] = [
  { key: "employee", header: "Employee", width: 22, group: "Leave" },
  { key: "employeeId", header: "Employee ID", width: 14, group: "Leave" },
  { key: "leaveType", header: "Leave Type", width: 16, group: "Leave" },
  { key: "startDate", header: "Start Date", width: 12, group: "Leave" },
  { key: "endDate", header: "End Date", width: 12, group: "Leave" },
  { key: "numberOfDays", header: "Days", width: 8, group: "Leave" },
  { key: "isHalfDay", header: "Half Day", width: 10, group: "Leave" },
  { key: "reason", header: "Reason", width: 30, group: "Leave" },
  { key: "status", header: "Status", width: 12, group: "Leave" },
  { key: "actionedBy", header: "Actioned By", width: 22, group: "Leave" },
];

export const PAYMENT_COLUMNS: ColumnDef[] = [
  { key: "serialNo", header: "Sr No", width: 8, group: "Payment" },
  { key: "candidateName", header: "Candidate", width: 22, group: "Payment" },
  { key: "company", header: "Company", width: 22, group: "Payment" },
  { key: "invoiceNumber", header: "Invoice No", width: 15, group: "Payment" },
  { key: "invoiceDate", header: "Invoice Date", width: 12, group: "Payment" },
  { key: "invoiceAmount", header: "Invoice Amount", width: 14, group: "Payment" },
  { key: "gstAmount", header: "GST", width: 10, group: "Payment" },
  { key: "tdsAmount", header: "TDS", width: 10, group: "Payment" },
  { key: "amountReceived", header: "Amount Received", width: 14, group: "Payment" },
  { key: "paymentStatus", header: "Payment Status", width: 14, group: "Payment" },
  { key: "paymentDate", header: "Payment Date", width: 12, group: "Payment" },
];

export const EMPLOYEE_PERF_COLUMNS: ColumnDef[] = [
  { key: "employee", header: "Employee", width: 22, group: "Performance" },
  { key: "employeeId", header: "Employee ID", width: 14, group: "Performance" },
  { key: "role", header: "Role", width: 16, group: "Performance" },
  { key: "candidatesToday", header: "Candidates Today", width: 16, group: "Performance" },
  { key: "candidatesMonth", header: "Candidates This Month", width: 20, group: "Performance" },
  { key: "totalCandidates", header: "Total Candidates", width: 16, group: "Performance" },
  { key: "completionRate", header: "Completion Rate %", width: 16, group: "Performance" },
  { key: "attendanceRate", header: "Attendance Rate %", width: 16, group: "Performance" },
  { key: "status", header: "Status", width: 12, group: "Performance" },
];

// ─────────────────────────────────────────────────────────────
//  Report-type → source mapping + default ordered key set
//
//  Preserves the exact ordering the previous `getColumnsForReportType`
//  switch produced, so legacy schedules with no `columnConfig`
//  fall back to byte-identical output.
// ─────────────────────────────────────────────────────────────

const CANDIDATE_BASE_KEYS = [
  "serialNo",
  "candidateName",
  "contactNo",
  "emailId",
  "zone",
  "state",
  "location",
  "profile",
  "experience",
  "currentCtc",
  "expectedCtc",
  "status",
  "stage",
  "recruiterName",
  "company",
  "createdAt",
];

interface ReportTypeMeta {
  source: ColumnSource;
  defaultKeys: string[];
}

const REPORT_TYPE_META: Record<ReportType, ReportTypeMeta> = {
  ATTENDANCE: { source: "attendance", defaultKeys: ATTENDANCE_COLUMNS.map((c) => c.key) },
  LEAVE: { source: "leave", defaultKeys: LEAVE_COLUMNS.map((c) => c.key) },
  PAYMENT_INVOICE: { source: "payment", defaultKeys: PAYMENT_COLUMNS.map((c) => c.key) },
  EMPLOYEE_PERFORMANCE_ALL: {
    source: "employee_perf",
    defaultKeys: EMPLOYEE_PERF_COLUMNS.map((c) => c.key),
  },
  EMPLOYEE_PERFORMANCE_RECRUITERS: {
    source: "employee_perf",
    defaultKeys: EMPLOYEE_PERF_COLUMNS.map((c) => c.key),
  },
  EMPLOYEE_PERFORMANCE_RMS: {
    source: "employee_perf",
    defaultKeys: EMPLOYEE_PERF_COLUMNS.map((c) => c.key),
  },
  EMPLOYEE_PERFORMANCE_INDIVIDUAL: {
    source: "employee_perf",
    defaultKeys: EMPLOYEE_PERF_COLUMNS.map((c) => c.key),
  },
  HR_FEEDBACK: {
    source: "candidate",
    defaultKeys: [...CANDIDATE_BASE_KEYS, "hrManager", "hrFeedback", "cvSharedOnDate"],
  },
  WORK_PROFILE: {
    source: "candidate",
    defaultKeys: [
      ...CANDIDATE_BASE_KEYS,
      "currentDesignation",
      "currentOrganization",
      "higherQualification",
      "noticePeriod",
    ],
  },
  COMPANY_SPECIFIC: {
    source: "candidate",
    defaultKeys: [...CANDIDATE_BASE_KEYS, "serviceProvider", "dateOfJoining"],
  },
  SERVICE_PROVIDER_SPECIFIC: {
    source: "candidate",
    defaultKeys: [...CANDIDATE_BASE_KEYS, "serviceProvider", "hrManager"],
  },
  HR_SPECIFIC: {
    source: "candidate",
    defaultKeys: [...CANDIDATE_BASE_KEYS, "hrManager", "hrFeedback"],
  },
  ZONE_WISE: { source: "candidate", defaultKeys: CANDIDATE_BASE_KEYS },
  STATUS_BASED: { source: "candidate", defaultKeys: CANDIDATE_BASE_KEYS },
  CANDIDATE: { source: "candidate", defaultKeys: CANDIDATE_BASE_KEYS },
  RECRUITMENT: { source: "candidate", defaultKeys: CANDIDATE_BASE_KEYS },
  CANDIDATE_MIS: { source: "candidate", defaultKeys: CANDIDATE_BASE_KEYS },
  DAILY_RECRUITMENT_BATCH: { source: "candidate", defaultKeys: CANDIDATE_BASE_KEYS },
  DAILY_RECRUITMENT_INDIVIDUAL: { source: "candidate", defaultKeys: CANDIDATE_BASE_KEYS },
  // CUSTOM exposes the full candidate pool; admin builds whatever
  // subset they want. Sensible default = the base set.
  CUSTOM: { source: "candidate", defaultKeys: CANDIDATE_BASE_KEYS },
};

const SOURCE_POOL: Record<ColumnSource, ColumnDef[]> = {
  candidate: CANDIDATE_COLUMNS,
  attendance: ATTENDANCE_COLUMNS,
  leave: LEAVE_COLUMNS,
  payment: PAYMENT_COLUMNS,
  employee_perf: EMPLOYEE_PERF_COLUMNS,
};

/** Source pool — every column the picker may show for this report type. */
export function getColumnPool(reportType: ReportType): ColumnDef[] {
  return SOURCE_POOL[REPORT_TYPE_META[reportType].source];
}

/** Source identifier — used by the fetcher to pick the right query. */
export function getReportSource(reportType: ReportType): ColumnSource {
  return REPORT_TYPE_META[reportType].source;
}

/** Default ordered key list when no columnConfig is supplied. */
export function getDefaultColumnKeys(reportType: ReportType): string[] {
  return REPORT_TYPE_META[reportType].defaultKeys.slice();
}

/**
 * Validate + canonicalize a caller-supplied key list.
 * - Drops unknown keys (don't throw — schedules + templates outlive
 *   schema changes, so we degrade gracefully and log).
 * - De-duplicates while preserving first occurrence.
 * - Falls back to defaults if the result would be empty.
 * Returns the cleaned ordered key list.
 */
export function sanitizeColumnKeys(reportType: ReportType, keys: unknown): string[] {
  const pool = getColumnPool(reportType);
  const allowed = new Set(pool.map((c) => c.key));
  const arr = Array.isArray(keys) ? keys : [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const k of arr) {
    if (typeof k !== "string") continue;
    if (!allowed.has(k)) continue;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(k);
  }
  return out.length > 0 ? out : getDefaultColumnKeys(reportType);
}

/**
 * Strict variant — throws on invalid keys. Used by the template
 * save endpoint where we want to surface mistakes to the admin.
 */
export function validateColumnKeys(reportType: ReportType, keys: unknown): string[] {
  if (!Array.isArray(keys) || keys.length === 0) {
    throw new Error("columnConfig must be a non-empty array of column keys");
  }
  const pool = getColumnPool(reportType);
  const allowed = new Set(pool.map((c) => c.key));
  const seen = new Set<string>();
  const out: string[] = [];
  for (const k of keys) {
    if (typeof k !== "string") {
      throw new Error("columnConfig must contain only string keys");
    }
    if (!allowed.has(k)) {
      throw new Error(`Unknown column key "${k}" for report type ${reportType}`);
    }
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(k);
  }
  return out;
}

/** Resolve an ordered key list to full ColumnDef objects for ExcelJS. */
export function resolveColumnDefs(reportType: ReportType, keys: string[]): ColumnDef[] {
  const pool = getColumnPool(reportType);
  const byKey = new Map(pool.map((c) => [c.key, c]));
  const out: ColumnDef[] = [];
  for (const k of keys) {
    const def = byKey.get(k);
    if (def) out.push(def);
  }
  return out;
}

/**
 * Picker payload sent to the frontend — type, source, full pool
 * grouped, and default selection. Single endpoint feeds the UI so
 * the registry can never drift between layers.
 */
export interface ReportTypeColumnInfo {
  reportType: ReportType;
  source: ColumnSource;
  defaultKeys: string[];
  columns: ColumnDef[];
}

export function getColumnInfo(reportType: ReportType): ReportTypeColumnInfo {
  return {
    reportType,
    source: getReportSource(reportType),
    defaultKeys: getDefaultColumnKeys(reportType),
    columns: getColumnPool(reportType),
  };
}

const ALL_REPORT_TYPES: ReportType[] = Object.keys(REPORT_TYPE_META) as ReportType[];

export function getAllColumnInfo(): ReportTypeColumnInfo[] {
  return ALL_REPORT_TYPES.map(getColumnInfo);
}
