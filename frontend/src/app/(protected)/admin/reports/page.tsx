"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { qk } from "@/lib/query-keys";
import Link from "next/link";
import {
  Trash2,
  CheckCircle,
  Eye,
  FileText,
  IndianRupee,
  MoreVertical,
  GitBranch,
  CreditCard,
  Building2,
  Users,
  TrendingUp,
  Clock,
  MapPin,
  Phone,
  Mail,
  Calendar,
  Filter,
  X,
  BarChart3,
  User,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";
import {
  listCandidates,
  type CandidateReport,
} from "@/services/candidate.service";
import { api } from "@/lib/api";
import {
  bulkUpdateStage,
  bulkUpdatePaymentStatus,
  bulkAssignCompany,
} from "@/services/bulk.service";
import { listCompanies, type Company } from "@/services/company.service";
import {
  PageHeader,
  DataTable,
  Badge,
  IconButton,
  Tooltip,
  DropdownMenu,
  Modal,
  Select,
  Button,
  SearchInput,
  Card,
  FilterPresetsBar,
  PromptDialog,
} from "@/components/ui";
import type { Column, ViewType, RowDensity } from "@/components/ui";
import { useFilterPresets } from "@/hooks/use-filter-presets";
import { cn } from "@/lib/utils";
import { pluralize } from "@/utils/format";
import { CalendarDatePicker } from "@/components/ui/calendar-date-picker";
import { DEFAULT_LARGE_PAGE_SIZE } from "@/constants/pagination";

// ──────────────────────────────────────────────
//  Admin Candidate Reports — Spec Section 6.1, 6.2
//  Enhanced with summary stats, advanced filters,
//  card/table view, stage pipeline, and quick actions
// ──────────────────────────────────────────────

type DateTab = "today" | "yesterday" | "this_week" | "this_month" | "custom" | "all";

const STAGE_OPTIONS = [
  { label: "Sourced", value: "SOURCED", color: "bg-info-100 text-info-700" },
  { label: "Screened", value: "SCREENED", color: "bg-primary-100 text-primary-700" },
  { label: "CV Shared", value: "CV_SHARED", color: "bg-secondary-100 text-secondary-700" },
  { label: "Interview", value: "INTERVIEW_SCHEDULED", color: "bg-warning-100 text-warning-700" },
  { label: "Selected", value: "SELECTED", color: "bg-success-100 text-success-700" },
  { label: "Joined", value: "JOINED", color: "bg-success-50 text-success-700" },
  { label: "Invoiced", value: "INVOICED", color: "bg-primary-50 text-primary-700" },
  { label: "Closed", value: "CLOSED", color: "bg-bg-muted text-text-secondary" },
  { label: "Rejected", value: "REJECTED", color: "bg-error-100 text-error-700" },
  { label: "On Hold", value: "ON_HOLD", color: "bg-warning-50 text-warning-700" },
];

const STAGE_COLOR_MAP: Record<string, string> = Object.fromEntries(
  STAGE_OPTIONS.map((s) => [s.value, s.color]),
);

function stageLabel(value: string): string {
  return STAGE_OPTIONS.find((s) => s.value === value)?.label ?? value.replace("_", " ");
}

export default function AdminReportsPage() {
  const qc = useQueryClient();
  const [dateTab, setDateTab] = useState<DateTab>("today");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_LARGE_PAGE_SIZE);
  const [sortKey, setSortKey] = useState("");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [viewType, setViewType] = useState<ViewType>("table");

  // Advanced filters
  const [showFilters, setShowFilters] = useState(false);
  const [stageFilter, setStageFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [zoneFilter, setZoneFilter] = useState("");
  const [recruiterFilter, setRecruiterFilter] = useState("");
  const [companyFilter, setCompanyFilter] = useState("");

  // Bulk operation modals
  const [bulkStageOpen, setBulkStageOpen] = useState(false);
  const [bulkStageValue, setBulkStageValue] = useState("");
  const [bulkPaymentOpen, setBulkPaymentOpen] = useState(false);
  const [bulkPaymentValue, setBulkPaymentValue] = useState("");
  const [bulkCompanyOpen, setBulkCompanyOpen] = useState(false);
  const [bulkCompanyValue, setBulkCompanyValue] = useState("");
  const [companies, setCompanies] = useState<Company[]>([]);

  // New DataTable feature state
  const { presets, activePresetId, savePreset, applyPreset, deletePreset, clearActive } =
    useFilterPresets("admin-reports");
  const [density, setDensity] = useState<RowDensity>("default");
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set());

  const activeFilterCount = [
    stageFilter,
    statusFilter,
    zoneFilter,
    recruiterFilter,
    companyFilter,
  ].filter(Boolean).length;

  const getDateRange = useCallback(() => {
    const now = new Date();
    switch (dateTab) {
      case "today": {
        const start = new Date(now);
        start.setHours(0, 0, 0, 0);
        return { dateFrom: start.toISOString(), dateTo: now.toISOString() };
      }
      case "yesterday": {
        const y = new Date(now);
        y.setDate(y.getDate() - 1);
        y.setHours(0, 0, 0, 0);
        const yEnd = new Date(y);
        yEnd.setHours(23, 59, 59, 999);
        return { dateFrom: y.toISOString(), dateTo: yEnd.toISOString() };
      }
      case "this_week": {
        const start = new Date(now);
        start.setDate(start.getDate() - start.getDay());
        start.setHours(0, 0, 0, 0);
        return { dateFrom: start.toISOString(), dateTo: now.toISOString() };
      }
      case "this_month": {
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        return { dateFrom: start.toISOString(), dateTo: now.toISOString() };
      }
      case "custom":
        return {
          ...(customFrom && { dateFrom: new Date(customFrom).toISOString() }),
          ...(customTo && { dateTo: new Date(`${customTo}T23:59:59`).toISOString() }),
        };
      default:
        return {};
    }
  }, [dateTab, customFrom, customTo]);

  const reportsQuery = useQuery({
    queryKey: qk.reports.list({
      scope: "admin",
      page,
      pageSize,
      search,
      sortKey,
      sortDir,
      stageFilter,
      statusFilter,
      zoneFilter,
      recruiterFilter,
      companyFilter,
      dateTab,
      customFrom,
      customTo,
    }),
    queryFn: () => {
      const params: Record<string, string> = { page: String(page), limit: String(pageSize) };
      if (search) params["search"] = search;
      if (sortKey) {
        params["sortBy"] = sortKey;
        params["sortDir"] = sortDir;
      }
      if (stageFilter) params["candidateStage"] = stageFilter;
      if (statusFilter) params["status"] = statusFilter;
      if (zoneFilter) params["zone"] = zoneFilter;
      if (recruiterFilter) params["recruiterId"] = recruiterFilter;
      if (companyFilter) params["companyId"] = companyFilter;
      const range = getDateRange();
      if (range.dateFrom) params["dateFrom"] = range.dateFrom;
      if (range.dateTo) params["dateTo"] = range.dateTo;
      return listCandidates(params);
    },
    placeholderData: keepPreviousData,
  });
  const data = reportsQuery.data ?? null;
  const isLoading = reportsQuery.isLoading;
  const fetchData = useCallback(
    () => qc.invalidateQueries({ queryKey: qk.reports.lists() }),
    [qc],
  );

  // ── Summary stats (computed from current page data) ──
  const stats = useMemo(() => {
    const items = data?.data ?? [];
    const total = data?.pagination.total ?? 0;
    const complete = items.filter((r) => r.status === "COMPLETE").length;
    const pending = items.filter((r) => r.status !== "COMPLETE").length;
    const stageCounts: Record<string, number> = {};
    for (const item of items) {
      stageCounts[item.candidateStage] = (stageCounts[item.candidateStage] ?? 0) + 1;
    }
    return { total, complete, pending, stageCounts };
  }, [data]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  // Fetch companies for bulk assign
  const companiesQuery = useQuery({
    queryKey: qk.companies.list(),
    queryFn: () => listCompanies(),
    staleTime: 5 * 60 * 1000,
  });
  useEffect(() => {
    // reason: mirroring react-query result into existing local state
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (companiesQuery.data) setCompanies(companiesQuery.data);
  }, [companiesQuery.data]);

  const handleSort = useCallback(
    (key: string | null, dir: "asc" | "desc" | null) => {
      setSortKey(key ?? "");
      setSortDir(dir ?? "asc");
      setPage(1);
    },
    [],
  );

  const handleExport = useCallback(async () => {
    try {
      const params: Record<string, string> = {};
      if (search) params["search"] = search;
      const range = getDateRange();
      if (range.dateFrom) params["dateFrom"] = range.dateFrom;
      if (range.dateTo) params["dateTo"] = range.dateTo;
      const res = await api.get("/candidates/export", { params, responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([res.data as BlobPart]));
      const a = document.createElement("a");
      a.href = url;
      a.download = `candidates-${dateTab}-${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success("Export downloaded");
    } catch {
      toast.error("Export failed");
    }
  }, [search, getDateRange, dateTab]);

  const handleBulkDelete = useCallback(
    async (ids: Set<string>) => {
      try {
        await api.post("/bulk/delete", { ids: Array.from(ids) });
        toast.success(`${ids.size} record(s) moved to trash`);
        setSelectedIds(new Set());
        void fetchData();
      } catch {
        toast.error("Bulk delete failed");
      }
    },
    [fetchData],
  );

  const handleBulkStatusComplete = useCallback(
    async (ids: Set<string>) => {
      try {
        await api.post("/bulk/status", { ids: Array.from(ids), status: "COMPLETE" });
        toast.success(`${ids.size} record(s) marked Complete`);
        setSelectedIds(new Set());
        void fetchData();
      } catch {
        toast.error("Bulk status update failed");
      }
    },
    [fetchData],
  );

  const handleBulkStage = async () => {
    if (!bulkStageValue || selectedIds.size === 0) return;
    try {
      await bulkUpdateStage(Array.from(selectedIds), bulkStageValue);
      toast.success(`${selectedIds.size} record(s) updated to ${stageLabel(bulkStageValue)}`);
      setSelectedIds(new Set());
      setBulkStageOpen(false);
      setBulkStageValue("");
      void fetchData();
    } catch {
      toast.error("Bulk stage update failed");
    }
  };

  const handleBulkPayment = async () => {
    if (!bulkPaymentValue || selectedIds.size === 0) return;
    try {
      await bulkUpdatePaymentStatus(Array.from(selectedIds), bulkPaymentValue);
      toast.success(`${selectedIds.size} record(s) payment status updated`);
      setSelectedIds(new Set());
      setBulkPaymentOpen(false);
      setBulkPaymentValue("");
      void fetchData();
    } catch {
      toast.error("Bulk payment update failed");
    }
  };

  const handleBulkCompany = async () => {
    if (!bulkCompanyValue || selectedIds.size === 0) return;
    try {
      await bulkAssignCompany(Array.from(selectedIds), bulkCompanyValue);
      toast.success(`${selectedIds.size} record(s) assigned to company`);
      setSelectedIds(new Set());
      setBulkCompanyOpen(false);
      setBulkCompanyValue("");
      void fetchData();
    } catch {
      toast.error("Bulk company assignment failed");
    }
  };

  const clearAllFilters = () => {
    setStageFilter("");
    setStatusFilter("");
    setZoneFilter("");
    setRecruiterFilter("");
    setCompanyFilter("");
    setSearch("");
    setDateTab("today");
    setPage(1);
  };

  // ── Date tabs ──
  const tabs: { key: DateTab; label: string }[] = [
    { key: "today", label: "Today" },
    { key: "yesterday", label: "Yesterday" },
    { key: "this_week", label: "This Week" },
    { key: "this_month", label: "This Month" },
    { key: "all", label: "All Time" },
    { key: "custom", label: "Custom" },
  ];

  // ── Table columns ──
  const columns: Column<CandidateReport>[] = [
    { key: "globalSerialNumber", header: "#", width: "55px", sortable: true },
    {
      key: "candidateName",
      header: "Candidate",
      sortable: true,
      cell: (r) => (
        <div className="flex items-center gap-2.5">
          <div className="bg-primary-100 text-primary-700 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold">
            {(r.candidateName ?? "?")[0]?.toUpperCase()}
          </div>
          <div className="min-w-0">
            <Link
              href={`/admin/reports/${r.id}`}
              className="text-text-primary block truncate font-medium hover:underline"
            >
              {r.candidateName ?? "\u2014"}
            </Link>
            <div className="text-text-muted flex items-center gap-2 text-xs">
              {r.contactNo && (
                <span className="flex items-center gap-0.5">
                  <Phone size={10} />
                  {r.contactNo}
                </span>
              )}
              {r.emailId && (
                <span className="flex items-center gap-0.5 truncate">
                  <Mail size={10} />
                  {r.emailId}
                </span>
              )}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: "zone",
      header: "Zone",
      sortable: true,
      defaultHidden: true,
      cell: (r) => (
        <span className="bg-bg-muted text-text-secondary inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs">
          <MapPin size={10} />
          {r.zone}
        </span>
      ),
    },
    {
      key: "location",
      header: "Location",
      sortable: true,
      defaultHidden: true,
      cell: (r) => (
        <span className="text-text-muted text-xs">
          {[r.location, r.state].filter(Boolean).join(", ") || "\u2014"}
        </span>
      ),
    },
    {
      key: "recruiter",
      header: "Recruiter",
      sortable: true,
      cell: (r) => (
        <div className="flex items-center gap-1.5">
          <div className="bg-bg-muted flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-medium">
            {r.recruiter.firstName[0]}
          </div>
          <span className="text-text-secondary truncate text-xs">
            {r.recruiter.firstName} {r.recruiter.lastName}
          </span>
        </div>
      ),
    },
    {
      key: "company",
      header: "Company",
      sortable: true,
      cell: (r) => (
        <span className="text-text-secondary text-xs">{r.company?.name ?? "\u2014"}</span>
      ),
    },
    {
      key: "candidateStage",
      header: "Stage",
      sortable: true,
      cell: (r) => (
        <span
          className={cn(
            "rounded-full px-2.5 py-1 text-xs font-medium",
            STAGE_COLOR_MAP[r.candidateStage] ?? "bg-gray-100 text-gray-700",
          )}
        >
          {stageLabel(r.candidateStage)}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      cell: (r) => (
        <Badge variant={r.status === "COMPLETE" ? "success" : "warning"} size="sm" dot>
          {r.status ?? "PENDING"}
        </Badge>
      ),
    },
    {
      key: "createdAt",
      header: "Date",
      sortable: true,
      defaultHidden: true,
      cell: (r) => (
        <span className="text-text-muted flex items-center gap-1 text-xs">
          <Calendar size={10} />
          {new Date(r.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      width: "50px",
      cell: (r) => (
        <DropdownMenu
          align="right"
          trigger={
            <Tooltip content="Actions">
              <IconButton icon={MoreVertical} aria-label="Actions" size="sm" variant="ghost" />
            </Tooltip>
          }
          groups={[
            {
              items: [
                {
                  label: "View Details",
                  icon: Eye,
                  onClick: () => window.open(`/admin/reports/${r.id}`, "_self"),
                },
                {
                  label: "Candidate Info",
                  icon: User,
                  onClick: () => window.open(`/admin/reports/${r.id}?tab=candidate`, "_self"),
                },
                {
                  label: "Recruitment",
                  icon: FileText,
                  onClick: () => window.open(`/admin/reports/${r.id}?tab=recruitment`, "_self"),
                },
                {
                  label: "MIS / Invoice",
                  icon: IndianRupee,
                  onClick: () => window.open(`/admin/reports/${r.id}?tab=mis`, "_self"),
                },
              ],
            },
          ]}
        />
      ),
    },
  ];

  // ── Card renderer for card view ──
  const cardRenderer = (r: CandidateReport) => (
    <Card padding="sm" className="transition-shadow hover:shadow-md">
      <div className="space-y-3">
        {/* Header: name + stage */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <div className="bg-primary-100 text-primary-700 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold">
              {(r.candidateName ?? "?")[0]?.toUpperCase()}
            </div>
            <div>
              <Link
                href={`/admin/reports/${r.id}`}
                className="text-text-primary font-medium hover:underline"
              >
                {r.candidateName ?? "\u2014"}
              </Link>
              <div className="text-text-muted text-xs">#{r.globalSerialNumber}</div>
            </div>
          </div>
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[10px] font-medium",
              STAGE_COLOR_MAP[r.candidateStage] ?? "bg-gray-100 text-gray-700",
            )}
          >
            {stageLabel(r.candidateStage)}
          </span>
        </div>

        {/* Contact */}
        <div className="text-text-muted space-y-1 text-xs">
          {r.contactNo && (
            <div className="flex items-center gap-1.5">
              <Phone size={11} />
              {r.contactNo}
            </div>
          )}
          {r.emailId && (
            <div className="flex items-center gap-1.5 truncate">
              <Mail size={11} />
              {r.emailId}
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <MapPin size={11} />
            {[r.location, r.state, r.zone].filter(Boolean).join(", ") || "\u2014"}
          </div>
        </div>

        {/* Footer: recruiter + company + status */}
        <div className="border-border-default flex items-center justify-between border-t pt-2">
          <div className="text-text-muted text-xs">
            <span className="text-text-secondary font-medium">
              {r.recruiter.firstName} {r.recruiter.lastName}
            </span>
            {r.company && <span> &middot; {r.company.name}</span>}
          </div>
          <Badge variant={r.status === "COMPLETE" ? "success" : "warning"} size="sm">
            {r.status ?? "PENDING"}
          </Badge>
        </div>
      </div>
    </Card>
  );

  const detailRenderer = useCallback(
    (r: CandidateReport) => (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="bg-primary-100 text-primary-700 flex h-12 w-12 items-center justify-center rounded-full text-lg font-bold">
            {(r.candidateName ?? "?")[0]?.toUpperCase()}
          </div>
          <div>
            <p className="text-text-primary text-lg font-semibold">{r.candidateName ?? "\u2014"}</p>
            <p className="text-text-muted text-sm">#{r.globalSerialNumber}</p>
          </div>
        </div>
        <div className="border-border-default divide-border-default divide-y rounded-lg border">
          {[
            ["Phone", r.contactNo],
            ["Email", r.emailId],
            ["Location", [r.location, r.state, r.zone].filter(Boolean).join(", ")],
            ["Company", r.company?.name],
            ["Recruiter", r.recruiter ? `${r.recruiter.firstName} ${r.recruiter.lastName}` : null],
            ["Stage", r.candidateStage],
            ["Status", r.status],
            [
              "Date Sourced",
              r.createdAt ? new Date(r.createdAt).toLocaleDateString("en-IN") : null,
            ],
          ].map(([label, value]) => (
            <div key={String(label)} className="flex justify-between px-4 py-2.5 text-sm">
              <span className="text-text-muted">{label}</span>
              <span className="text-text-primary font-medium">{value || "\u2014"}</span>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <Link
            href={`/admin/reports/${r.id}`}
            className="bg-primary-500 hover:bg-primary-600 flex-1 rounded-md px-4 py-2 text-center text-sm font-medium text-white"
          >
            View Full Report
          </Link>
        </div>
      </div>
    ),
    [],
  );

  const [reassignIds, setReassignIds] = useState<Set<string>>(new Set());
  const handleBulkReassign = useCallback((ids: Set<string>) => {
    setReassignIds(ids);
  }, []);
  const doReassign = useCallback(
    async (recruiterId: string) => {
      try {
        for (const id of reassignIds) {
          await api.patch(`/candidates/${id}`, { recruiterId });
        }
        toast.success(`${pluralize(reassignIds.size, "candidate")} reassigned`);
        setReassignIds(new Set());
        void fetchData();
      } catch {
        toast.error("Reassignment failed");
      }
    },
    [reassignIds, fetchData],
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <PageHeader
        title="Candidate Reports"
        description={pluralize(stats.total, "candidate")}
      />

      {/* ── Summary Stats Cards ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card padding="sm">
          <div className="flex items-center gap-3">
            <div className="bg-primary-100 flex h-10 w-10 items-center justify-center rounded-lg">
              <Users size={18} className="text-primary-600" />
            </div>
            <div>
              <p className="text-text-muted text-xs">Total</p>
              <p className="text-text-primary text-xl font-bold">{stats.total.toLocaleString()}</p>
            </div>
          </div>
        </Card>
        <Card padding="sm">
          <div className="flex items-center gap-3">
            <div className="bg-success-100 flex h-10 w-10 items-center justify-center rounded-lg">
              <CheckCircle size={18} className="text-success-600" />
            </div>
            <div>
              <p className="text-text-muted text-xs">Complete</p>
              <p className="text-success-600 text-xl font-bold">{stats.complete}</p>
            </div>
          </div>
        </Card>
        <Card padding="sm">
          <div className="flex items-center gap-3">
            <div className="bg-warning-100 flex h-10 w-10 items-center justify-center rounded-lg">
              <Clock size={18} className="text-warning-600" />
            </div>
            <div>
              <p className="text-text-muted text-xs">Pending</p>
              <p className="text-warning-600 text-xl font-bold">{stats.pending}</p>
            </div>
          </div>
        </Card>
        <Card padding="sm">
          <div className="flex items-center gap-3">
            <div className="bg-info-100 flex h-10 w-10 items-center justify-center rounded-lg">
              <TrendingUp size={18} className="text-info-600" />
            </div>
            <div>
              <p className="text-text-muted text-xs">Completion</p>
              <p className="text-info-600 text-xl font-bold">
                {stats.total > 0
                  ? Math.round((stats.complete / (stats.complete + stats.pending)) * 100)
                  : 0}
                %
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* ── Stage Pipeline (mini bar showing distribution) ── */}
      {Object.keys(stats.stageCounts).length > 0 && (
        <Card padding="sm">
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <BarChart3 size={14} className="text-text-muted shrink-0" />
            <span className="text-text-muted shrink-0 text-xs font-medium">Pipeline:</span>
            {STAGE_OPTIONS.map((stage) => {
              const count = stats.stageCounts[stage.value] ?? 0;
              if (count === 0) return null;
              return (
                <button
                  key={stage.value}
                  onClick={() => {
                    setStageFilter(stage.value);
                    setPage(1);
                  }}
                  className={cn(
                    "flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-all",
                    stageFilter === stage.value
                      ? "ring-primary-500 ring-2 ring-offset-1"
                      : "hover:ring-1 hover:ring-gray-300",
                    stage.color,
                  )}
                >
                  {stage.label}
                  <span className="rounded-full bg-white/60 px-1.5 py-0.5 text-[10px] font-bold">
                    {count}
                  </span>
                </button>
              );
            })}
            {stageFilter && (
              <button
                onClick={() => {
                  setStageFilter("");
                  setPage(1);
                }}
                className="text-text-muted hover:text-error-500 ml-1 shrink-0"
                aria-label="Clear stage filter"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </Card>
      )}

      {/* ── Date Tabs + Search + Filter Toggle ── */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Date tabs */}
        <div className="border-border-default bg-bg-muted flex gap-0.5 rounded-lg border p-0.5">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => {
                setDateTab(tab.key);
                setPage(1);
              }}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                dateTab === tab.key
                  ? "bg-bg-surface text-text-primary shadow-xs"
                  : "text-text-muted hover:text-text-secondary",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Custom date range (shown when custom tab is active) */}
        {dateTab === "custom" && (
          <div className="flex items-center gap-2">
            <CalendarDatePicker
              value={customFrom}
              onChange={(val) => {
                setCustomFrom(val);
                setPage(1);
              }}
              size="sm"
            />
            <span className="text-text-muted text-xs">to</span>
            <CalendarDatePicker
              value={customTo}
              onChange={(val) => {
                setCustomTo(val);
                setPage(1);
              }}
              size="sm"
            />
          </div>
        )}

        {/* Search — shares the row with date tabs and filter toggle */}
        <SearchInput
          value={search}
          onChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          placeholder="Search by name, phone, email..."
          historyKey="candidates"
          suggestions
          className="max-w-md min-w-48 flex-1"
        />

        {/* Filter toggle */}
        <Button
          variant={showFilters ? "primary" : "outline"}
          size="sm"
          leftIcon={Filter}
          onClick={() => setShowFilters(!showFilters)}
        >
          Filters{activeFilterCount > 0 && ` (${activeFilterCount})`}
        </Button>

        {activeFilterCount > 0 && (
          <Button variant="ghost" size="sm" leftIcon={X} onClick={clearAllFilters}>
            Clear all
          </Button>
        )}
      </div>

      {/* ── Filter Presets ── */}
      <FilterPresetsBar
        presets={presets}
        activePresetId={activePresetId}
        onApply={(id) => {
          const filters = applyPreset(id);
          if (filters) {
            if (filters.stage) setStageFilter(filters.stage);
            if (filters.status) setStatusFilter(filters.status);
          }
        }}
        onSave={(name) => {
          savePreset(name, {
            ...(stageFilter && { stage: stageFilter }),
            ...(statusFilter && { status: statusFilter }),
          });
        }}
        onDelete={deletePreset}
        onClear={clearActive}
      />

      {/* ── Advanced Filters Panel (collapsible) ── */}
      {showFilters && (
        <Card padding="sm">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <div>
              <label className="text-text-muted mb-1 block text-xs font-medium">Stage</label>
              <Select
                value={stageFilter}
                onChange={(e) => {
                  setStageFilter(e.target.value);
                  setPage(1);
                }}
                options={[
                  { label: "All Stages", value: "" },
                  ...STAGE_OPTIONS.map((s) => ({ label: s.label, value: s.value })),
                ]}
              />
            </div>
            <div>
              <label className="text-text-muted mb-1 block text-xs font-medium">Status</label>
              <Select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                options={[
                  { label: "All Statuses", value: "" },
                  { label: "Pending", value: "PENDING" },
                  { label: "Complete", value: "COMPLETE" },
                ]}
              />
            </div>
            <div>
              <label className="text-text-muted mb-1 block text-xs font-medium">Zone</label>
              <Select
                value={zoneFilter}
                onChange={(e) => {
                  setZoneFilter(e.target.value);
                  setPage(1);
                }}
                options={[
                  { label: "All Zones", value: "" },
                  { label: "West", value: "WEST" },
                  { label: "East", value: "EAST" },
                  { label: "North", value: "NORTH" },
                  { label: "South", value: "SOUTH" },
                  { label: "Central", value: "CENTRAL" },
                ]}
              />
            </div>
            <div>
              <label className="text-text-muted mb-1 block text-xs font-medium">Company</label>
              <Select
                value={companyFilter}
                onChange={(e) => {
                  setCompanyFilter(e.target.value);
                  setPage(1);
                }}
                options={[
                  { label: "All Companies", value: "" },
                  ...companies.map((c) => ({ label: c.name, value: c.id })),
                ]}
              />
            </div>
            <div className="flex items-end">
              <Button variant="ghost" size="sm" leftIcon={X} onClick={clearAllFilters} fullWidth>
                Reset
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* ── DataTable with all features ── */}
      <DataTable
        columns={columns}
        data={data?.data ?? []}
        loading={isLoading}
        emptyIcon={FileText}
        emptyTitle="No candidate reports"
        emptyDescription="No records match your current filters. Try adjusting your date range or filters."
        // Sorting
        sortKey={sortKey}
        sortDir={sortDir}
        onSort={handleSort}
        // Pagination
        page={page}
        totalPages={data?.pagination.totalPages ?? 1}
        total={data?.pagination.total ?? 0}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={(size) => {
          setPageSize(size);
          setPage(1);
        }}
        // Selection + Bulk
        selectable
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        getRowId={(r) => r.id}
        bulkActions={[
          {
            label: "Mark Complete",
            icon: CheckCircle,
            onClick: (ids) => void handleBulkStatusComplete(ids),
          },
          { label: "Change Stage", icon: GitBranch, onClick: () => setBulkStageOpen(true) },
          { label: "Payment Status", icon: CreditCard, onClick: () => setBulkPaymentOpen(true) },
          { label: "Assign Company", icon: Building2, onClick: () => setBulkCompanyOpen(true) },
          { label: "Reassign", icon: UserPlus, onClick: (ids) => void handleBulkReassign(ids) },
          {
            label: "Delete",
            icon: Trash2,
            variant: "danger",
            onClick: (ids) => void handleBulkDelete(ids),
          },
        ]}
        // View toggle
        viewType={viewType}
        onViewTypeChange={setViewType}
        cardRenderer={cardRenderer}
        // Quick filters
        quickFilters={[
          { label: "All", value: "", active: statusFilter === "" && stageFilter === "" },
          { label: "Pending", value: "PENDING", active: statusFilter === "PENDING" },
          { label: "Complete", value: "COMPLETE", active: statusFilter === "COMPLETE" },
        ]}
        onQuickFilter={(val) => {
          setStatusFilter(val);
          setStageFilter("");
          setPage(1);
        }}
        // Export
        onExport={() => void handleExport()}
        stickyHeader
        compact
        // New DataTable features
        enableColumnVisibility
        density={density}
        onDensityChange={setDensity}
        pinnedIds={pinnedIds}
        onPinChange={setPinnedIds}
        detailRenderer={detailRenderer}
        detailTitle={(r) => r.candidateName ?? "Candidate Details"}
        enableKeyboardNav
        collapsibleGroups
      />

      {/* ── Bulk Modals ── */}
      <Modal
        open={bulkStageOpen}
        onClose={() => setBulkStageOpen(false)}
        title={`Change Stage (${selectedIds.size} selected)`}
      >
        <div className="space-y-4">
          <Select
            value={bulkStageValue}
            onChange={(e) => setBulkStageValue(e.target.value)}
            options={[
              { label: "Select stage...", value: "" },
              ...STAGE_OPTIONS.map((s) => ({ label: s.label, value: s.value })),
            ]}
          />
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setBulkStageOpen(false)}>
              Cancel
            </Button>
            <Button disabled={!bulkStageValue} onClick={() => void handleBulkStage()}>
              Apply
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={bulkPaymentOpen}
        onClose={() => setBulkPaymentOpen(false)}
        title={`Payment Status (${selectedIds.size} selected)`}
      >
        <div className="space-y-4">
          <Select
            value={bulkPaymentValue}
            onChange={(e) => setBulkPaymentValue(e.target.value)}
            options={[
              { label: "Select status...", value: "" },
              { label: "Unpaid", value: "UNPAID" },
              { label: "Partial", value: "PARTIAL" },
              { label: "Paid", value: "PAID" },
              { label: "Overdue", value: "OVERDUE" },
            ]}
          />
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setBulkPaymentOpen(false)}>
              Cancel
            </Button>
            <Button disabled={!bulkPaymentValue} onClick={() => void handleBulkPayment()}>
              Apply
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={bulkCompanyOpen}
        onClose={() => setBulkCompanyOpen(false)}
        title={`Assign Company (${selectedIds.size} selected)`}
      >
        <div className="space-y-4">
          <Select
            value={bulkCompanyValue}
            onChange={(e) => setBulkCompanyValue(e.target.value)}
            options={[
              { label: "Select company...", value: "" },
              ...companies.map((c) => ({ label: c.name, value: c.id })),
            ]}
          />
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setBulkCompanyOpen(false)}>
              Cancel
            </Button>
            <Button disabled={!bulkCompanyValue} onClick={() => void handleBulkCompany()}>
              Apply
            </Button>
          </div>
        </div>
      </Modal>

      {/* Bulk Reassign Prompt */}
      <PromptDialog
        open={reassignIds.size > 0}
        onClose={() => setReassignIds(new Set())}
        onConfirm={doReassign}
        title="Reassign Candidates"
        description={`Reassign ${reassignIds.size} selected candidate(s) to a different recruiter.`}
        inputLabel="Recruiter Employee ID"
        placeholder="e.g. EMP001"
        confirmLabel="Reassign"
      />
    </div>
  );
}
