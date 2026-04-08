"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { qk } from "@/lib/query-keys";
import {
  Download,
  Plus,
  Pause,
  Play,
  Trash2,
  Pencil,
  CalendarClock,
  History,
  LayoutDashboard,
  Search,
  ExternalLink,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { api, extractApiError } from "@/lib/api";
import { downloadReport } from "@/services/report.service";
import {
  PageHeader,
  Card,
  Badge,
  Button,
  Modal,
  Tabs,
  Select,
  Input,
  FormField,
  DataTable,
  DateRangePicker,
  TableSkeleton,
  EmptyState,
  ConfirmDialog,
  IconButton,
  Tooltip,
} from "@/components/ui";
import type { Column } from "@/components/ui";
import { listCompanies, type Company } from "@/services/company.service";
import { listUsers } from "@/services/user.service";
import { TimePicker } from "@/components/ui/time-picker";
import { useTabSearchParam } from "@/hooks";

const REPORTS_TAB_IDS = ["generate", "schedule", "history", "active"] as const;
type ReportsTabId = (typeof REPORTS_TAB_IDS)[number];

// ──────────────────────────────────────────────
//  Reports Management — Spec Section 20
//  Four sections: Generate, Schedule, History, Active
// ──────────────────────────────────────────────

// §20.2 — All 19 report types + CUSTOM for extensibility
const REPORT_TYPES = [
  { value: "DAILY_RECRUITMENT_BATCH", label: "Daily Recruitment Report (Batch)" },
  { value: "DAILY_RECRUITMENT_INDIVIDUAL", label: "Daily Recruitment Report (Individual)" },
  { value: "WORK_PROFILE", label: "Work Profile Report" },
  { value: "CANDIDATE", label: "Candidate Report" },
  { value: "RECRUITMENT", label: "Recruitment Report" },
  { value: "CANDIDATE_MIS", label: "Candidate MIS Report" },
  { value: "HR_FEEDBACK", label: "HR Feedback Report" },
  { value: "COMPANY_SPECIFIC", label: "Company-Specific Report" },
  { value: "SERVICE_PROVIDER_SPECIFIC", label: "Service Provider-Specific Report" },
  { value: "HR_SPECIFIC", label: "HR Manager-Specific Report" },
  { value: "ZONE_WISE", label: "Zone-Wise Report" },
  { value: "STATUS_BASED", label: "Status-Based Report" },
  { value: "PAYMENT_INVOICE", label: "Payment & Invoice Report" },
  { value: "ATTENDANCE", label: "Attendance Report" },
  { value: "LEAVE", label: "Leave Report" },
  { value: "EMPLOYEE_PERFORMANCE_ALL", label: "Employee Performance (All)" },
  { value: "EMPLOYEE_PERFORMANCE_RECRUITERS", label: "Employee Performance (Recruiters)" },
  { value: "EMPLOYEE_PERFORMANCE_RMS", label: "Employee Performance (RMs)" },
  { value: "EMPLOYEE_PERFORMANCE_INDIVIDUAL", label: "Employee Performance (Individual)" },
] as const;

const REPORT_TYPE_OPTIONS = REPORT_TYPES.map((r) => ({ value: r.value, label: r.label }));

// §20.2 — Time range preset options
const TIME_RANGE_PRESETS = [
  { value: "", label: "All Time" },
  { value: "daily", label: "Daily (Today)" },
  { value: "weekly", label: "Weekly (This Week)" },
  { value: "15-day", label: "15 Days" },
  { value: "monthly", label: "Monthly (This Month)" },
  { value: "3-month", label: "3 Months" },
  { value: "6-month", label: "6 Months" },
  { value: "yearly", label: "Yearly (This Year)" },
  { value: "custom", label: "Custom Date Range" },
];

// §20.2 — Zone filter options (individual zones + Set A/B)
const ZONE_OPTIONS = [
  { value: "", label: "All Zones" },
  { value: "NORTH", label: "North" },
  { value: "SOUTH", label: "South" },
  { value: "EAST", label: "East" },
  { value: "WEST", label: "West" },
  { value: "CENTRAL", label: "Central" },
  { value: "SET_A", label: "Set A (West + Central)" },
  { value: "SET_B", label: "Set B (East + North + South)" },
];

// §20.2 — Status filter
const STATUS_OPTIONS = [
  { value: "", label: "All Statuses" },
  { value: "COMPLETE", label: "Complete" },
  { value: "PENDING", label: "Pending" },
];

// §20.2 — Payment status filter
const PAYMENT_STATUS_OPTIONS = [
  { value: "", label: "All" },
  { value: "UNPAID", label: "Unpaid" },
  { value: "PARTIALLY_PAID", label: "Partially Paid" },
  { value: "PAID", label: "Paid" },
];

// §20.2 — Employee scope options
const EMPLOYEE_SCOPE_OPTIONS = [
  { value: "", label: "All Employees" },
  { value: "RECRUITERS", label: "All Recruiters" },
  { value: "RMS", label: "All Reporting Managers" },
  { value: "INDIVIDUAL", label: "Individual Employee" },
];

// §20.2 — Recruiter scope options
const RECRUITER_SCOPE_OPTIONS = [
  { value: "BATCH", label: "Batch (All Recruiters)" },
  { value: "INDIVIDUAL", label: "Individual Recruiter" },
];

const TAB_ITEMS = [
  { id: "generate", label: "Generate & Download", icon: Download },
  { id: "schedule", label: "Schedule Email Reports", icon: CalendarClock },
  { id: "history", label: "Report History", icon: History },
  { id: "active", label: "Active Schedules", icon: LayoutDashboard },
];

/** Compute date range from a preset key */
function computeDateRange(preset: string): { dateFrom?: string; dateTo?: string } {
  if (!preset || preset === "custom") return {};
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let start: Date;
  switch (preset) {
    case "daily":
      start = today;
      break;
    case "weekly": {
      const day = today.getDay();
      start = new Date(today);
      start.setDate(today.getDate() - (day === 0 ? 6 : day - 1)); // Monday
      break;
    }
    case "15-day":
      start = new Date(today);
      start.setDate(today.getDate() - 14);
      break;
    case "monthly":
      start = new Date(today.getFullYear(), today.getMonth(), 1);
      break;
    case "3-month":
      start = new Date(today);
      start.setMonth(today.getMonth() - 3);
      break;
    case "6-month":
      start = new Date(today);
      start.setMonth(today.getMonth() - 6);
      break;
    case "yearly":
      start = new Date(today.getFullYear(), 0, 1);
      break;
    default:
      return {};
  }
  return { dateFrom: start.toISOString(), dateTo: now.toISOString() };
}

interface Schedule {
  id: string;
  reportType: string;
  reportName: string;
  filters: Record<string, string> | null;
  frequency: string;
  time: string;
  recipients: string[];
  lastSent: string | null;
  nextScheduled: string;
  status: "active" | "paused";
}

interface HistoryEntry {
  id: string;
  reportName: string;
  reportType: string;
  source: "ON_PAGE" | "SCHEDULED";
  generatedAt: string;
  fileSize: number | null;
  filters: string;
  recipientEmails: string[] | null;
  sentAt: string | null;
  deliveryStatus: string | null;
  cloudUrl: string | null;
  isExpired: boolean;
}

export default function ReportsManagementPage() {
  const [tab, setTab] = useTabSearchParam<ReportsTabId>("tab", "generate", REPORTS_TAB_IDS);

  return (
    <div className="space-y-4">
      <PageHeader title="Reports Management" />
      <Tabs tabs={TAB_ITEMS} activeTab={tab} onChange={(id) => setTab(id as ReportsTabId)} />
      {tab === "generate" && <GenerateTab />}
      {tab === "schedule" && <ScheduleTab />}
      {tab === "history" && <HistoryTab />}
      {tab === "active" && <ActiveTab />}
    </div>
  );
}

// ──────────────────────────────────────────────
//  Shared filter fields component (used by Generate + Schedule)
// ──────────────────────────────────────────────
interface FilterFieldsProps {
  filters: ReportFilters;
  onChange: (filters: ReportFilters) => void;
  companies: Company[];
  recruiters: { id: string; name: string }[];
  employees: { id: string; name: string }[];
}

interface ReportFilters {
  timeRangePreset: string;
  dateFrom: string;
  dateTo: string;
  recruiterScope: string;
  recruiterId: string;
  employeeScope: string;
  employeeId: string;
  companyId: string;
  serviceProviderId: string;
  hrManagerId: string;
  zone: string;
  status: string;
  paymentStatus: string;
}

const EMPTY_FILTERS: ReportFilters = {
  timeRangePreset: "",
  dateFrom: "",
  dateTo: "",
  recruiterScope: "BATCH",
  recruiterId: "",
  employeeScope: "",
  employeeId: "",
  companyId: "",
  serviceProviderId: "",
  hrManagerId: "",
  zone: "",
  status: "",
  paymentStatus: "",
};

function FilterFields({ filters, onChange, companies, recruiters, employees }: FilterFieldsProps) {
  const selectedCompany = companies.find((c) => c.id === filters.companyId);
  const spOptions =
    selectedCompany?.serviceProviders.map((sp) => ({ value: sp.id, label: sp.name })) ?? [];
  const hrOptions =
    selectedCompany?.hrManagers.map((hr) => ({ value: hr.id, label: hr.name })) ?? [];

  const set = (key: keyof ReportFilters, val: string) => {
    const next = { ...filters, [key]: val };
    // Clear dependent fields
    if (key === "companyId") {
      next.serviceProviderId = "";
      next.hrManagerId = "";
    }
    if (key === "timeRangePreset" && val !== "custom") {
      next.dateFrom = "";
      next.dateTo = "";
    }
    if (key === "recruiterScope" && val === "BATCH") {
      next.recruiterId = "";
    }
    if (key === "employeeScope" && val !== "INDIVIDUAL") {
      next.employeeId = "";
    }
    onChange(next);
  };

  return (
    <div className="space-y-4">
      {/* §20.2 — Time Range */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <FormField label="Time Range">
          <Select
            value={filters.timeRangePreset}
            onChange={(e) => set("timeRangePreset", e.target.value)}
            options={TIME_RANGE_PRESETS}
          />
        </FormField>
        {filters.timeRangePreset === "custom" && (
          <div className="sm:col-span-2">
            <DateRangePicker
              startDate={filters.dateFrom}
              endDate={filters.dateTo}
              onChange={(start, end) => onChange({ ...filters, dateFrom: start, dateTo: end })}
            />
          </div>
        )}
      </div>

      {/* §20.2 — Recruiter Scope */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <FormField label="Recruiter Scope">
          <Select
            value={filters.recruiterScope}
            onChange={(e) => set("recruiterScope", e.target.value)}
            options={RECRUITER_SCOPE_OPTIONS}
          />
        </FormField>
        {filters.recruiterScope === "INDIVIDUAL" && (
          <FormField label="Select Recruiter">
            <Select
              value={filters.recruiterId}
              onChange={(e) => set("recruiterId", e.target.value)}
              options={[
                { value: "", label: "Select recruiter..." },
                ...recruiters.map((r) => ({ value: r.id, label: r.name })),
              ]}
            />
          </FormField>
        )}
      </div>

      {/* §20.2 — Employee Scope */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <FormField label="Employee Scope">
          <Select
            value={filters.employeeScope}
            onChange={(e) => set("employeeScope", e.target.value)}
            options={EMPLOYEE_SCOPE_OPTIONS}
          />
        </FormField>
        {filters.employeeScope === "INDIVIDUAL" && (
          <FormField label="Select Employee">
            <Select
              value={filters.employeeId}
              onChange={(e) => set("employeeId", e.target.value)}
              options={[
                { value: "", label: "Select employee..." },
                ...employees.map((emp) => ({ value: emp.id, label: emp.name })),
              ]}
            />
          </FormField>
        )}
      </div>

      {/* §20.2 — Company / SP / HR dropdowns */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <FormField label="Company">
          <Select
            value={filters.companyId}
            onChange={(e) => set("companyId", e.target.value)}
            options={[
              { value: "", label: "All Companies" },
              ...companies.map((c) => ({ value: c.id, label: c.name })),
            ]}
          />
        </FormField>
        <FormField label="Service Provider">
          <Select
            value={filters.serviceProviderId}
            onChange={(e) => set("serviceProviderId", e.target.value)}
            options={[{ value: "", label: "All SPs" }, ...spOptions]}
            disabled={!filters.companyId}
          />
        </FormField>
        <FormField label="HR Manager">
          <Select
            value={filters.hrManagerId}
            onChange={(e) => set("hrManagerId", e.target.value)}
            options={[{ value: "", label: "All HRs" }, ...hrOptions]}
            disabled={!filters.companyId}
          />
        </FormField>
      </div>

      {/* §20.2 — Zone / Status / Payment Status */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <FormField label="Zone">
          <Select
            value={filters.zone}
            onChange={(e) => set("zone", e.target.value)}
            options={ZONE_OPTIONS}
          />
        </FormField>
        <FormField label="Status">
          <Select
            value={filters.status}
            onChange={(e) => set("status", e.target.value)}
            options={STATUS_OPTIONS}
          />
        </FormField>
        <FormField label="Payment Status">
          <Select
            value={filters.paymentStatus}
            onChange={(e) => set("paymentStatus", e.target.value)}
            options={PAYMENT_STATUS_OPTIONS}
          />
        </FormField>
      </div>
    </div>
  );
}

/** Convert UI filters to API params */
function filtersToApiParams(filters: ReportFilters): Record<string, string> {
  const params: Record<string, string> = {};
  // Time range
  if (filters.timeRangePreset && filters.timeRangePreset !== "custom") {
    const range = computeDateRange(filters.timeRangePreset);
    if (range.dateFrom) params.dateFrom = range.dateFrom;
    if (range.dateTo) params.dateTo = range.dateTo;
  } else if (filters.timeRangePreset === "custom") {
    if (filters.dateFrom) params.dateFrom = filters.dateFrom;
    if (filters.dateTo) params.dateTo = filters.dateTo;
  }
  if (filters.recruiterScope === "INDIVIDUAL" && filters.recruiterId)
    params.recruiterId = filters.recruiterId;
  if (filters.employeeScope === "INDIVIDUAL" && filters.employeeId)
    params.employeeId = filters.employeeId;
  else if (filters.employeeScope === "RECRUITERS") params.employeeScope = "RECRUITERS";
  else if (filters.employeeScope === "RMS") params.employeeScope = "RMS";
  if (filters.companyId) params.companyId = filters.companyId;
  if (filters.serviceProviderId) params.serviceProviderId = filters.serviceProviderId;
  if (filters.hrManagerId) params.hrManagerId = filters.hrManagerId;
  if (filters.zone) params.zone = filters.zone;
  if (filters.status) params.status = filters.status;
  if (filters.paymentStatus) params.paymentStatus = filters.paymentStatus;
  return params;
}

/** Shared hook to load companies + users for dropdowns */
function useFilterData() {
  const filterDataQuery = useQuery({
    queryKey: qk.reportsManagement.filterData(),
    queryFn: async () => {
      const [cs, us] = await Promise.all([
        listCompanies().catch(() => [] as Company[]),
        listUsers({ limit: "5000" }).catch(
          () => ({ data: [] as { id: string; firstName: string; lastName: string; role: string }[] }),
        ),
      ]);
      return { companies: cs, allUsers: us.data };
    },
    staleTime: 5 * 60 * 1000,
  });
  const companies = filterDataQuery.data?.companies ?? [];
  const allUsers = useMemo(() => filterDataQuery.data?.allUsers ?? [], [filterDataQuery.data]);

  const recruiters = useMemo(
    () =>
      allUsers
        .filter((u) => u.role === "RECRUITER")
        .map((u) => ({ id: u.id, name: `${u.firstName} ${u.lastName}` })),
    [allUsers],
  );

  const employees = useMemo(
    () => allUsers.map((u) => ({ id: u.id, name: `${u.firstName} ${u.lastName}` })),
    [allUsers],
  );

  return { companies, recruiters, employees };
}

// ──────────────────────────────────────────────
//  Tab 1: Generate & Download — §20.2
// ──────────────────────────────────────────────
function GenerateTab() {
  const [reportType, setReportType] = useState("");
  const [filters, setFilters] = useState<ReportFilters>(EMPTY_FILTERS);
  const [generating, setGenerating] = useState(false);
  const { companies, recruiters, employees } = useFilterData();

  const handleGenerate = async () => {
    if (!reportType) {
      toast.error("Select a report type");
      return;
    }
    setGenerating(true);
    try {
      const apiFilters = filtersToApiParams(filters);

      await downloadReport({ reportType, filters: apiFilters });
      toast.success("Report generated and downloaded");
    } catch (err) {
      toast.error(extractApiError(err).message);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Card padding="lg" className="max-w-3xl">
      <Card.Body>
        <div className="space-y-5">
          <FormField label="Report Type">
            <Select
              value={reportType}
              onChange={(e) => setReportType(e.target.value)}
              options={[{ value: "", label: "Select report type..." }, ...REPORT_TYPE_OPTIONS]}
            />
          </FormField>

          <FilterFields
            filters={filters}
            onChange={setFilters}
            companies={companies}
            recruiters={recruiters}
            employees={employees}
          />

          <Button leftIcon={Download} loading={generating} onClick={() => void handleGenerate()}>
            Generate &amp; Download
          </Button>
        </div>
      </Card.Body>
    </Card>
  );
}

// ──────────────────────────────────────────────
//  Tab 2: Schedule Email Reports — §20.3
// ──────────────────────────────────────────────
function ScheduleTab() {
  const qc = useQueryClient();
  const schedulesQuery = useQuery({
    queryKey: qk.reportsManagement.schedules(),
    queryFn: async () => {
      const res = await api.get("/reports/schedules");
      return res.data.data as Schedule[];
    },
  });
  const schedules = schedulesQuery.data ?? [];
  const isLoading = schedulesQuery.isLoading;
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<Schedule | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Schedule | null>(null);
  const { companies, recruiters, employees } = useFilterData();

  // Form state for create/edit modal
  const [formReportType, setFormReportType] = useState("");
  const [formReportName, setFormReportName] = useState("");
  const [formFrequency, setFormFrequency] = useState("");
  const [formTime, setFormTime] = useState("");
  const [formRecipients, setFormRecipients] = useState("");
  const [formFilters, setFormFilters] = useState<ReportFilters>(EMPTY_FILTERS);

  const fetchSchedules = useCallback(
    () => qc.invalidateQueries({ queryKey: qk.reportsManagement.schedules() }),
    [qc],
  );

  useEffect(() => {
    if (schedulesQuery.isError) {
      toast.error(extractApiError(schedulesQuery.error).message);
    }
  }, [schedulesQuery.isError, schedulesQuery.error]);

  const openCreate = () => {
    setEditTarget(null);
    setFormReportType("");
    setFormReportName("");
    setFormFrequency("");
    setFormTime("");
    setFormRecipients("");
    setFormFilters(EMPTY_FILTERS);
    setShowModal(true);
  };

  const openEdit = (s: Schedule) => {
    setEditTarget(s);
    setFormReportType(s.reportType);
    setFormReportName(s.reportName);
    setFormFrequency(s.frequency);
    setFormTime(s.time);
    setFormRecipients(s.recipients.join(", "));
    // Restore filters from schedule
    setFormFilters({
      ...EMPTY_FILTERS,
      ...(s.filters as Partial<ReportFilters> | null),
    });
    setShowModal(true);
  };

  const toggleStatus = async (s: Schedule) => {
    try {
      await api.patch(`/reports/schedules/${s.id}`, {
        status: s.status === "active" ? "paused" : "active",
      });
      toast.success(s.status === "active" ? "Schedule paused" : "Schedule activated");
      void fetchSchedules();
    } catch (err) {
      toast.error(extractApiError(err).message);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/reports/schedules/${deleteTarget.id}`);
      toast.success("Schedule deleted");
      setDeleteTarget(null);
      void fetchSchedules();
    } catch (err) {
      toast.error(extractApiError(err).message);
    }
  };

  const handleSubmit = async () => {
    if (!formReportType || !formFrequency || !formTime) {
      toast.error("Fill in all required fields");
      return;
    }
    const recipients = formRecipients
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (recipients.length === 0) {
      toast.error("Add at least one recipient email");
      return;
    }
    const payload = {
      reportType: formReportType,
      reportName:
        formReportName ||
        REPORT_TYPES.find((r) => r.value === formReportType)?.label ||
        formReportType,
      frequency: formFrequency,
      time: formTime,
      recipients,
      filters: filtersToApiParams(formFilters),
    };
    try {
      if (editTarget) {
        await api.patch(`/reports/schedules/${editTarget.id}`, payload);
        toast.success("Schedule updated");
      } else {
        await api.post("/reports/schedules", payload);
        toast.success("Schedule created");
      }
      setShowModal(false);
      void fetchSchedules();
    } catch (err) {
      toast.error(extractApiError(err).message);
    }
  };

  const freqVariant = (freq: string) => {
    if (freq === "DAILY") return "success" as const;
    if (freq === "MONTHLY") return "warning" as const;
    if (freq === "YEARLY") return "danger" as const;
    return "default" as const;
  };

  const columns: Column<Schedule>[] = [
    {
      key: "reportType",
      header: "Report",
      cell: (s) => (
        <span className="text-text-primary font-medium">
          {REPORT_TYPES.find((r) => r.value === s.reportType)?.label ?? s.reportType}
        </span>
      ),
    },
    {
      key: "frequency",
      header: "Frequency",
      cell: (s) => <Badge variant={freqVariant(s.frequency)}>{s.frequency}</Badge>,
    },
    { key: "time", header: "Time" },
    {
      key: "recipients",
      header: "Recipients",
      cell: (s) => `${s.recipients.length} recipient${s.recipients.length !== 1 ? "s" : ""}`,
    },
    {
      key: "lastSent",
      header: "Last Sent",
      cell: (s) => (s.lastSent ? new Date(s.lastSent).toLocaleDateString("en-IN") : "Never"),
    },
    {
      key: "nextScheduled",
      header: "Next",
      cell: (s) => new Date(s.nextScheduled).toLocaleDateString("en-IN"),
    },
    {
      key: "status",
      header: "Status",
      cell: (s) => (
        <Badge variant={s.status === "active" ? "success" : "warning"}>
          {s.status === "active" ? "Active" : "Paused"}
        </Badge>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      cell: (s) => (
        <div className="flex gap-1">
          <IconButton
            icon={s.status === "active" ? Pause : Play}
            aria-label={s.status === "active" ? "Pause" : "Resume"}
            size="xs"
            onClick={() => void toggleStatus(s)}
          />
          <IconButton icon={Pencil} aria-label="Edit" size="xs" onClick={() => openEdit(s)} />
          <IconButton
            icon={Trash2}
            aria-label="Delete"
            variant="danger"
            size="xs"
            onClick={() => setDeleteTarget(s)}
          />
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button leftIcon={Plus} onClick={openCreate}>
          Create Schedule
        </Button>
      </div>

      {isLoading ? (
        <TableSkeleton rows={4} />
      ) : schedules.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title="No scheduled reports"
          description="Create a schedule to automate report delivery."
        />
      ) : (
        <DataTable columns={columns} data={schedules} />
      )}

      {/* §20.3 — Create/Edit Schedule Modal with all filters */}
      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editTarget ? "Edit Schedule" : "Create Schedule"}
        size="full"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Report Type" required>
              <Select
                value={formReportType}
                onChange={(e) => setFormReportType(e.target.value)}
                options={[{ value: "", label: "Select..." }, ...REPORT_TYPE_OPTIONS]}
              />
            </FormField>
            <FormField label="Report Name">
              <Input
                value={formReportName}
                onChange={(e) => setFormReportName(e.target.value)}
                placeholder="Optional display name"
              />
            </FormField>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <FormField label="Frequency" required>
              <Select
                value={formFrequency}
                onChange={(e) => setFormFrequency(e.target.value)}
                options={[
                  { value: "", label: "Select..." },
                  { value: "DAILY", label: "Daily" },
                  { value: "MONTHLY", label: "Monthly" },
                  { value: "YEARLY", label: "Yearly" },
                ]}
              />
            </FormField>
            <FormField label="Time of Day" required>
              <TimePicker value={formTime} onChange={(val) => setFormTime(val)} />
            </FormField>
            <FormField label="Recipient Emails" required>
              <Input
                value={formRecipients}
                onChange={(e) => setFormRecipients(e.target.value)}
                placeholder="email1@co.in, email2@co.in"
              />
            </FormField>
          </div>

          {/* §20.3 — All filtering/scoping options same as Generate */}
          <div className="border-border-default rounded-lg border p-4">
            <p className="text-text-secondary mb-3 text-sm font-medium">
              Report Filters &amp; Scope
            </p>
            <FilterFields
              filters={formFilters}
              onChange={setFormFilters}
              companies={companies}
              recruiters={recruiters}
              employees={employees}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button onClick={() => void handleSubmit()}>
              {editTarget ? "Save Changes" : "Create Schedule"}
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Schedule"
        description={`Delete the "${deleteTarget?.reportName || deleteTarget?.reportType}" schedule? This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  );
}

// ──────────────────────────────────────────────
//  Tab 3: Report History — §20.4
// ──────────────────────────────────────────────
function HistoryTab() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [filterType, setFilterType] = useState("");
  const [filterSource, setFilterSource] = useState("");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState("generatedAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const historyQuery = useQuery({
    queryKey: qk.reportsManagement.history({
      page,
      pageSize,
      sortKey,
      sortDir,
      filterType,
      filterSource,
      search,
      dateFrom,
      dateTo,
    }),
    queryFn: async () => {
      const params: Record<string, string | number> = {
        page,
        limit: pageSize,
        sortBy: sortKey,
        sortDir,
      };
      if (filterType) params.reportType = filterType;
      if (filterSource) params.source = filterSource;
      if (search) params.search = search;
      if (dateFrom) params.dateFrom = dateFrom;
      if (dateTo) params.dateTo = dateTo;
      const res = await api.get("/reports/history", { params });
      return {
        entries: res.data.data as HistoryEntry[],
        totalPages: (res.data.pagination?.totalPages ?? 1) as number,
        total: (res.data.pagination?.total ?? res.data.data.length) as number,
      };
    },
    placeholderData: keepPreviousData,
  });
  const entries = historyQuery.data?.entries ?? [];
  const totalPages = historyQuery.data?.totalPages ?? 1;
  const total = historyQuery.data?.total ?? 0;
  const isLoading = historyQuery.isLoading;

  useEffect(() => {
    if (historyQuery.isError) {
      toast.error(extractApiError(historyQuery.error).message);
    }
  }, [historyQuery.isError, historyQuery.error]);

  const handleSort = useCallback(
    (key: string | null, dir: "asc" | "desc" | null) => {
      setSortKey(key ?? "");
      setSortDir(dir ?? "asc");
      setPage(1);
    },
    [],
  );

  const columns: Column<HistoryEntry>[] = [
    {
      key: "reportName",
      header: "Report",
      sortable: true,
      cell: (e) => (
        <div>
          <span className="text-text-primary font-medium">{e.reportName}</span>
          <span className="text-text-muted ml-2 text-xs">
            {REPORT_TYPES.find((r) => r.value === e.reportType)?.label ?? e.reportType}
          </span>
        </div>
      ),
    },
    {
      key: "source",
      header: "Source",
      sortable: true,
      cell: (e) => (
        <Badge variant={e.source === "SCHEDULED" ? "success" : "warning"}>
          {e.source === "ON_PAGE" ? "On-Page" : "Scheduled"}
        </Badge>
      ),
    },
    {
      key: "generatedAt",
      header: "Generated",
      sortable: true,
      cell: (e) => new Date(e.generatedAt).toLocaleString("en-IN"),
    },
    {
      key: "fileSize",
      header: "Size",
      sortable: true,
      cell: (e) => (e.fileSize ? `${Math.round(e.fileSize / 1024)} KB` : "\u2014"),
    },
    {
      key: "filters",
      header: "Filters",
      cell: (e) => (
        <span className="block max-w-[200px] truncate text-xs">{e.filters || "\u2014"}</span>
      ),
    },
    {
      key: "recipientEmails",
      header: "Recipients",
      cell: (e) =>
        e.recipientEmails && e.recipientEmails.length > 0 ? e.recipientEmails.join(", ") : "\u2014",
    },
    {
      key: "sentAt",
      header: "Sent At",
      cell: (e) => (e.sentAt ? new Date(e.sentAt).toLocaleString("en-IN") : "\u2014"),
    },
    {
      key: "deliveryStatus",
      header: "Delivery",
      cell: (e) => {
        if (!e.deliveryStatus) return "\u2014";
        const variant =
          e.deliveryStatus === "SUCCESS"
            ? "success"
            : e.deliveryStatus === "FAILED"
              ? "danger"
              : "warning";
        return (
          <Badge variant={variant} size="sm">
            {e.deliveryStatus}
          </Badge>
        );
      },
    },
    {
      key: "download",
      header: "",
      width: "120px",
      cell: (e) =>
        e.isExpired ? (
          <Tooltip content="File removed after retention period">
            <Button variant="ghost" size="xs" leftIcon={AlertTriangle} disabled>
              Expired
            </Button>
          </Tooltip>
        ) : (
          <Button
            variant="ghost"
            size="xs"
            leftIcon={Download}
            disabled={!e.cloudUrl}
            onClick={() => e.cloudUrl && window.open(e.cloudUrl)}
          >
            Download
          </Button>
        ),
    },
  ];

  return (
    <div className="space-y-4">
      {/* §20.4 — Filters: type, source, date range, search */}
      <div className="flex flex-wrap items-end gap-3">
        <FormField label="Report Type">
          <Select
            value={filterType}
            onChange={(e) => {
              setFilterType(e.target.value);
              setPage(1);
            }}
            options={[{ value: "", label: "All types" }, ...REPORT_TYPE_OPTIONS]}
          />
        </FormField>
        <FormField label="Source">
          <Select
            value={filterSource}
            onChange={(e) => {
              setFilterSource(e.target.value);
              setPage(1);
            }}
            options={[
              { value: "", label: "All sources" },
              { value: "ON_PAGE", label: "On-Page" },
              { value: "SCHEDULED", label: "Scheduled" },
            ]}
          />
        </FormField>
        <DateRangePicker
          startDate={dateFrom}
          endDate={dateTo}
          onChange={(start, end) => {
            setDateFrom(start);
            setDateTo(end);
            setPage(1);
          }}
        />
        <div className="relative min-w-[200px]">
          <Search size={14} className="text-text-muted absolute top-1/2 left-3 -translate-y-1/2" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search reports..."
            className="pl-9"
          />
        </div>
      </div>

      <DataTable
        columns={columns}
        data={entries}
        loading={isLoading}
        emptyIcon={History}
        emptyTitle="No report history"
        emptyDescription="Generated reports will appear here."
        sortKey={sortKey}
        sortDir={sortDir}
        onSort={handleSort}
        page={page}
        totalPages={totalPages}
        total={total}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={(size) => {
          setPageSize(size);
          setPage(1);
        }}
        stickyHeader
      />
    </div>
  );
}

// ──────────────────────────────────────────────
//  Tab 4: Active Scheduled Reports Info — §20.5
// ──────────────────────────────────────────────
function ActiveTab() {
  const qc = useQueryClient();
  const schedulesQuery = useQuery({
    queryKey: qk.reportsManagement.schedules(),
    queryFn: async () => {
      const res = await api.get("/reports/schedules");
      return res.data.data as Schedule[];
    },
  });
  const schedules = schedulesQuery.data ?? [];
  const isLoading = schedulesQuery.isLoading;
  const [editTarget, setEditTarget] = useState<Schedule | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Schedule | null>(null);
  const { companies, recruiters, employees } = useFilterData();

  // Edit form state
  const [formReportType, setFormReportType] = useState("");
  const [formReportName, setFormReportName] = useState("");
  const [formFrequency, setFormFrequency] = useState("");
  const [formTime, setFormTime] = useState("");
  const [formRecipients, setFormRecipients] = useState("");
  const [formFilters, setFormFilters] = useState<ReportFilters>(EMPTY_FILTERS);

  // §20.5 — Fetch ALL schedules (active + paused), not just active
  const fetchSchedules = useCallback(
    () => qc.invalidateQueries({ queryKey: qk.reportsManagement.schedules() }),
    [qc],
  );

  useEffect(() => {
    if (schedulesQuery.isError) {
      toast.error(extractApiError(schedulesQuery.error).message);
    }
  }, [schedulesQuery.isError, schedulesQuery.error]);

  const togglePause = async (s: Schedule) => {
    try {
      await api.patch(`/reports/schedules/${s.id}`, {
        status: s.status === "active" ? "paused" : "active",
      });
      toast.success(s.status === "active" ? "Paused" : "Activated");
      void fetchSchedules();
    } catch (err) {
      toast.error(extractApiError(err).message);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/reports/schedules/${deleteTarget.id}`);
      toast.success("Schedule deleted");
      setDeleteTarget(null);
      void fetchSchedules();
    } catch (err) {
      toast.error(extractApiError(err).message);
    }
  };

  const openEdit = (s: Schedule) => {
    setEditTarget(s);
    setFormReportType(s.reportType);
    setFormReportName(s.reportName);
    setFormFrequency(s.frequency);
    setFormTime(s.time);
    setFormRecipients(s.recipients.join(", "));
    setFormFilters({
      ...EMPTY_FILTERS,
      ...(s.filters as Partial<ReportFilters> | null),
    });
  };

  const handleEditSubmit = async () => {
    if (!editTarget) return;
    const recipients = formRecipients
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    try {
      await api.patch(`/reports/schedules/${editTarget.id}`, {
        reportType: formReportType,
        reportName: formReportName || formReportType,
        frequency: formFrequency,
        time: formTime,
        recipients,
        filters: filtersToApiParams(formFilters),
      });
      toast.success("Schedule updated");
      setEditTarget(null);
      void fetchSchedules();
    } catch (err) {
      toast.error(extractApiError(err).message);
    }
  };

  /** §20.5 — Format filters for display on cards */
  const formatFilters = (filters: Record<string, string> | null): string => {
    if (!filters || Object.keys(filters).length === 0) return "No filters";
    return Object.entries(filters)
      .map(([k, v]) => `${k}: ${v}`)
      .join(", ");
  };

  if (isLoading) return <TableSkeleton rows={4} />;
  if (schedules.length === 0)
    return (
      <EmptyState
        icon={LayoutDashboard}
        title="No scheduled reports"
        description="Create scheduled reports from the Schedule tab."
      />
    );

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {schedules.map((s) => (
          <Card key={s.id}>
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-text-primary font-medium">
                  {REPORT_TYPES.find((r) => r.value === s.reportType)?.label ??
                    s.reportName ??
                    s.reportType}
                </h3>
                <p className="text-text-muted mt-0.5 text-xs">ID: {s.id.slice(0, 8)}...</p>
              </div>
              <Badge variant={s.status === "active" ? "success" : "warning"}>
                {s.status === "active" ? "Active" : "Paused"}
              </Badge>
            </div>
            <div className="text-text-secondary mt-3 space-y-1 text-sm">
              <p>
                <span className="text-text-muted">Frequency:</span> {s.frequency}
              </p>
              <p>
                <span className="text-text-muted">Time:</span> {s.time}
              </p>
              <p>
                <span className="text-text-muted">Recipients:</span> {s.recipients.join(", ")}
              </p>
              {/* §20.5 — Filters/Scope display */}
              <p className="truncate">
                <span className="text-text-muted">Filters:</span> {formatFilters(s.filters)}
              </p>
              <p>
                <span className="text-text-muted">Last sent:</span>{" "}
                {s.lastSent ? new Date(s.lastSent).toLocaleDateString("en-IN") : "Never"}
              </p>
              <p>
                <span className="text-text-muted">Next:</span>{" "}
                {new Date(s.nextScheduled).toLocaleDateString("en-IN")}
              </p>
            </div>
            <Card.Footer className="mt-4">
              <Button
                variant="outline"
                size="xs"
                leftIcon={s.status === "active" ? Pause : Play}
                onClick={() => void togglePause(s)}
              >
                {s.status === "active" ? "Pause" : "Resume"}
              </Button>
              <Button variant="outline" size="xs" leftIcon={Pencil} onClick={() => openEdit(s)}>
                Edit
              </Button>
              {/* §20.5 — Delete action on cards */}
              <Button
                variant="danger"
                size="xs"
                leftIcon={Trash2}
                onClick={() => setDeleteTarget(s)}
              >
                Delete
              </Button>
              {/* §20.5 — View delivery history link */}
              <Tooltip content="View delivery history for this schedule">
                <IconButton
                  icon={ExternalLink}
                  aria-label="View history"
                  size="xs"
                  variant="ghost"
                  onClick={() => {
                    // Navigate to history tab filtered by this schedule's report type
                    // Parent component manages tab state, so we use URL param approach
                    window.location.hash = `history-${s.reportType}`;
                  }}
                />
              </Tooltip>
            </Card.Footer>
          </Card>
        ))}
      </div>

      {/* §20.5 — Edit modal with full filter support */}
      <Modal
        open={!!editTarget}
        onClose={() => setEditTarget(null)}
        title="Edit Schedule"
        size="full"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Report Type">
              <Select
                value={formReportType}
                onChange={(e) => setFormReportType(e.target.value)}
                options={REPORT_TYPE_OPTIONS}
              />
            </FormField>
            <FormField label="Report Name">
              <Input
                value={formReportName}
                onChange={(e) => setFormReportName(e.target.value)}
                placeholder="Report name"
              />
            </FormField>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <FormField label="Frequency">
              <Select
                value={formFrequency}
                onChange={(e) => setFormFrequency(e.target.value)}
                options={[
                  { value: "DAILY", label: "Daily" },
                  { value: "MONTHLY", label: "Monthly" },
                  { value: "YEARLY", label: "Yearly" },
                ]}
              />
            </FormField>
            <FormField label="Time">
              <TimePicker value={formTime} onChange={(val) => setFormTime(val)} />
            </FormField>
            <FormField label="Recipients">
              <Input
                value={formRecipients}
                onChange={(e) => setFormRecipients(e.target.value)}
                placeholder="Emails (comma-separated)"
              />
            </FormField>
          </div>

          <div className="border-border-default rounded-lg border p-4">
            <p className="text-text-secondary mb-3 text-sm font-medium">
              Report Filters &amp; Scope
            </p>
            <FilterFields
              filters={formFilters}
              onChange={setFormFilters}
              companies={companies}
              recruiters={recruiters}
              employees={employees}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setEditTarget(null)}>
              Cancel
            </Button>
            <Button onClick={() => void handleEditSubmit()}>Save</Button>
          </div>
        </div>
      </Modal>

      {/* §20.5 — Delete confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Schedule"
        description={`Delete "${deleteTarget?.reportName || deleteTarget?.reportType}"? This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
      />
    </>
  );
}
