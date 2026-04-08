"use client";

import { useState, useCallback, useMemo } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { qk } from "@/lib/query-keys";
import { Download, Filter, X, ScrollText, Shield, Activity } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { exportToXLSX } from "@/utils/export-table";
import { DEFAULT_LARGE_PAGE_SIZE } from "@/constants/pagination";
import {
  PageHeader,
  Button,
  SearchInput,
  Select,
  DataTable,
  Badge,
  Modal,
  Card,
} from "@/components/ui";
import { CalendarDatePicker } from "@/components/ui/calendar-date-picker";
import type { Column, ViewType, RowDensity } from "@/components/ui";

// ──────────────────────────────────────────────
//  Audit Log — Spec Section 23.1
//  Full audit trail viewer with filters & expandable rows
// ──────────────────────────────────────────────

const ACTION_TYPES = ["CREATE", "UPDATE", "DELETE", "LOGIN", "LOGOUT", "IMPORT"] as const;
const ENTITY_TYPES = [
  "CANDIDATE_REPORT",
  "USER",
  "COMPANY",
  "ZONE",
  "HOLIDAY",
  "MASTER_DATA",
  "SETTING",
  "TARGET",
  "OFFER_LETTER",
  "EMAIL_TEMPLATE",
] as const;

const ACTION_OPTIONS = [
  { value: "", label: "All Actions" },
  ...ACTION_TYPES.map((a) => ({ value: a, label: a })),
];

const ENTITY_OPTIONS = [
  { value: "", label: "All Entities" },
  ...ENTITY_TYPES.map((e) => ({ value: e, label: e.replace(/_/g, " ") })),
];

type AuditEntry = {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  userRole: string;
  action: string;
  entityType: string;
  entityId: string;
  ipAddress: string;
  changes?: { old: Record<string, unknown>; new: Record<string, unknown> } | null;
};

type AuditResponse = {
  data: AuditEntry[];
  meta: { page: number; totalPages: number; total: number };
};

function formatTimestamp(ts: string) {
  const d = new Date(ts);
  return (
    d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) +
    " " +
    d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
  );
}

const ACTION_BADGE_VARIANT: Record<string, "success" | "warning" | "danger" | "default"> = {
  CREATE: "success",
  UPDATE: "warning",
  DELETE: "danger",
  LOGIN: "default",
  LOGOUT: "default",
  IMPORT: "success",
};

const ENTITY_BADGE_VARIANT: Record<string, "primary" | "info" | "default"> = {
  CANDIDATE_REPORT: "primary",
  USER: "info",
  COMPANY: "primary",
};

export default function AuditLogPage() {
  const [page, setPage] = useState(1);
  const [detailEntry, setDetailEntry] = useState<AuditEntry | null>(null);
  const [sortKey, setSortKey] = useState("");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [viewType, setViewType] = useState<ViewType>("table");
  const [density, setDensity] = useState<RowDensity>("default");
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set());

  // Filters
  const [actionFilter, setActionFilter] = useState("");
  const [entityFilter, setEntityFilter] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [appliedFilters, setAppliedFilters] = useState<Record<string, string>>({});

  const auditQuery = useQuery({
    queryKey: qk.auditLog.list({ page, ...appliedFilters }),
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(DEFAULT_LARGE_PAGE_SIZE),
      });
      if (appliedFilters.action) params.set("action", appliedFilters.action);
      if (appliedFilters.entityType) params.set("entityType", appliedFilters.entityType);
      if (appliedFilters.userId) params.set("userId", appliedFilters.userId);
      if (appliedFilters.dateFrom) params.set("dateFrom", appliedFilters.dateFrom);
      if (appliedFilters.dateTo) params.set("dateTo", appliedFilters.dateTo);
      const res = await api.get<AuditResponse>(`/audit-logs?${params.toString()}`);
      return res.data;
    },
    placeholderData: keepPreviousData,
  });
  const data = auditQuery.data ?? null;
  const loading = auditQuery.isLoading;
  const applyFilters = () => {
    setPage(1);
    setAppliedFilters({
      action: actionFilter,
      entityType: entityFilter,
      userId: userSearch,
      dateFrom,
      dateTo,
    });
  };

  const clearFilters = () => {
    setActionFilter("");
    setEntityFilter("");
    setUserSearch("");
    setDateFrom("");
    setDateTo("");
    setPage(1);
    setAppliedFilters({});
  };

  const handleExport = async () => {
    try {
      const params = new URLSearchParams();
      if (appliedFilters.action) params.set("action", appliedFilters.action);
      if (appliedFilters.entityType) params.set("entityType", appliedFilters.entityType);
      if (appliedFilters.userId) params.set("userId", appliedFilters.userId);
      if (appliedFilters.dateFrom) params.set("dateFrom", appliedFilters.dateFrom);
      if (appliedFilters.dateTo) params.set("dateTo", appliedFilters.dateTo);
      const res = await api.get(`/audit-logs/export?${params.toString()}`, {
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success("Audit log exported");
    } catch {
      toast.error("Export failed");
    }
  };

  const handleSort = useCallback(
    (key: string | null, dir: "asc" | "desc" | null) => {
      setSortKey(key ?? "");
      setSortDir(dir ?? "asc");
    },
    [],
  );

  const handleTableExport = useCallback(() => {
    exportToXLSX(
      data?.data ?? [],
      [
        { header: "Action", accessor: (r) => r.action },
        { header: "Entity Type", accessor: (r) => r.entityType.replace(/_/g, " ") },
        { header: "Entity ID", accessor: (r) => r.entityId },
        { header: "User", accessor: (r) => r.userName },
        { header: "Timestamp", accessor: (r) => formatTimestamp(r.timestamp) },
        { header: "IP", accessor: (r) => r.ipAddress },
      ],
      "audit-log-export",
    );
  }, [data]);

  const sortedEntries = useMemo(() => {
    const entries = data?.data ?? [];
    if (!sortKey) return entries;
    const sorted = [...entries].sort((a, b) => {
      let aVal: string | number = "";
      let bVal: string | number = "";
      switch (sortKey) {
        case "action":
          aVal = a.action.toLowerCase();
          bVal = b.action.toLowerCase();
          break;
        case "entityType":
          aVal = a.entityType.toLowerCase();
          bVal = b.entityType.toLowerCase();
          break;
        case "timestamp":
          aVal = new Date(a.timestamp).getTime();
          bVal = new Date(b.timestamp).getTime();
          break;
        case "userName":
          aVal = (a.userName ?? "").toLowerCase();
          bVal = (b.userName ?? "").toLowerCase();
          break;
        case "userRole":
          aVal = (a.userRole ?? "").toLowerCase();
          bVal = (b.userRole ?? "").toLowerCase();
          break;
        case "entityId":
          aVal = (a.entityId ?? "").toLowerCase();
          bVal = (b.entityId ?? "").toLowerCase();
          break;
        case "ipAddress":
          aVal = (a.ipAddress ?? "").toLowerCase();
          bVal = (b.ipAddress ?? "").toLowerCase();
          break;
        default:
          return 0;
      }
      if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [data, sortKey, sortDir]);

  const stats = useMemo(() => {
    const entries = data?.data ?? [];
    const total = data?.meta?.total ?? entries.length;
    const creates = entries.filter((e) => e.action === "CREATE").length;
    const updates = entries.filter((e) => e.action === "UPDATE").length;
    const deletes = entries.filter((e) => e.action === "DELETE").length;
    return { total, creates, updates, deletes };
  }, [data]);

  const totalPages = data?.meta?.totalPages ?? 1;

  const renderChanges = (changes: AuditEntry["changes"]) => {
    if (!changes) return <p className="text-text-muted text-xs">No change details recorded.</p>;
    const keys = Array.from(
      new Set([...Object.keys(changes.old ?? {}), ...Object.keys(changes.new ?? {})]),
    );
    if (keys.length === 0) return <p className="text-text-muted text-xs">No fields changed.</p>;
    return (
      <table className="w-full text-xs">
        <thead>
          <tr className="border-border-default border-b">
            <th className="text-text-secondary py-1 pr-4 text-left font-medium">Field</th>
            <th className="text-text-secondary py-1 pr-4 text-left font-medium">Old Value</th>
            <th className="text-text-secondary py-1 text-left font-medium">New Value</th>
          </tr>
        </thead>
        <tbody>
          {keys.map((key) => (
            <tr key={key} className="border-border-default border-b last:border-0">
              <td className="text-text-muted py-1 pr-4 font-mono">{key}</td>
              <td className="text-error-500 py-1 pr-4">
                {JSON.stringify(changes.old?.[key] ?? "—")}
              </td>
              <td className="text-success-500 py-1">{JSON.stringify(changes.new?.[key] ?? "—")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  const columns: Column<AuditEntry>[] = [
    {
      key: "timestamp",
      header: "Timestamp",
      sortable: true,
      cell: (row) => (
        <span className="text-text-primary whitespace-nowrap">
          {formatTimestamp(row.timestamp)}
        </span>
      ),
    },
    {
      key: "userName",
      header: "User",
      sortable: true,
      cell: (row) => <span className="text-text-primary">{row.userName}</span>,
    },
    {
      key: "userRole",
      header: "Role",
      sortable: true,
      cell: (row) => (
        <Badge variant="default" size="sm">
          {row.userRole.replace(/_/g, " ")}
        </Badge>
      ),
    },
    {
      key: "action",
      header: "Action",
      sortable: true,
      cell: (row) => (
        <Badge variant={ACTION_BADGE_VARIANT[row.action] ?? "default"} size="sm">
          {row.action}
        </Badge>
      ),
    },
    {
      key: "entityType",
      header: "Entity Type",
      sortable: true,
      cell: (row) => (
        <Badge variant={ENTITY_BADGE_VARIANT[row.entityType] ?? "default"} size="sm">
          {row.entityType.replace(/_/g, " ")}
        </Badge>
      ),
    },
    {
      key: "entityId",
      header: "Entity ID",
      sortable: true,
      cell: (row) => <span className="text-text-muted font-mono text-xs">{row.entityId}</span>,
    },
    {
      key: "ipAddress",
      header: "IP Address",
      sortable: true,
      cell: (row) => <span className="text-text-muted font-mono text-xs">{row.ipAddress}</span>,
    },
  ];

  const cardRenderer = useCallback(
    (row: AuditEntry) => (
      <Card
        padding="sm"
        className="cursor-pointer transition-shadow hover:shadow-md"
        onClick={() => setDetailEntry(row)}
      >
        <div className="space-y-2">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-text-primary font-medium">{row.userName}</p>
              <Badge variant="default" size="sm">
                {row.userRole.replace(/_/g, " ")}
              </Badge>
            </div>
            <Badge variant={ACTION_BADGE_VARIANT[row.action] ?? "default"} size="sm">
              {row.action}
            </Badge>
          </div>
          <div className="text-text-muted text-xs">
            <Badge variant={ENTITY_BADGE_VARIANT[row.entityType] ?? "default"} size="sm">
              {row.entityType.replace(/_/g, " ")}
            </Badge>
            <span className="ml-2 font-mono">{row.entityId.slice(0, 12)}…</span>
          </div>
          <div className="border-border-default text-text-muted flex items-center justify-between border-t pt-2 text-xs">
            <span>{formatTimestamp(row.timestamp)}</span>
            <span className="font-mono">{row.ipAddress}</span>
          </div>
        </div>
      </Card>
    ),
    [],
  );

  const cardDetailRenderer = useCallback(
    (row: AuditEntry) => (
      <div className="space-y-4">
        <div>
          <p className="text-text-primary text-lg font-semibold">{row.userName}</p>
          <p className="text-text-muted text-sm">{row.userRole.replace(/_/g, " ")}</p>
        </div>
        <div className="border-border-default divide-border-default divide-y rounded-lg border">
          {[
            ["Action", row.action],
            ["Entity Type", row.entityType.replace(/_/g, " ")],
            ["Entity ID", row.entityId],
            ["IP Address", row.ipAddress],
            ["Timestamp", formatTimestamp(row.timestamp)],
          ].map(([label, value]) => (
            <div key={String(label)} className="flex justify-between px-4 py-2.5 text-sm">
              <span className="text-text-muted">{label}</span>
              <span className="text-text-primary font-medium">{value}</span>
            </div>
          ))}
        </div>
        {row.changes && (
          <div>
            <p className="text-text-primary mb-2 font-medium">Changes</p>
            {renderChanges(row.changes)}
          </div>
        )}
      </div>
    ),
    [],
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <PageHeader
        title="Audit Log"
        actions={
          <Button leftIcon={Download} onClick={() => void handleExport()}>
            Export XLSX
          </Button>
        }
      />

      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card padding="sm">
          <div className="flex items-center gap-3">
            <div className="bg-primary-100 flex h-10 w-10 items-center justify-center rounded-lg">
              <ScrollText size={18} className="text-primary-600" />
            </div>
            <div>
              <p className="text-text-muted text-xs">Total Entries</p>
              <p className="text-text-primary text-xl font-bold">{stats.total.toLocaleString()}</p>
            </div>
          </div>
        </Card>
        <Card padding="sm">
          <div className="flex items-center gap-3">
            <div className="bg-success-100 flex h-10 w-10 items-center justify-center rounded-lg">
              <Activity size={18} className="text-success-600" />
            </div>
            <div>
              <p className="text-text-muted text-xs">Creates</p>
              <p className="text-success-600 text-xl font-bold">{stats.creates}</p>
            </div>
          </div>
        </Card>
        <Card padding="sm">
          <div className="flex items-center gap-3">
            <div className="bg-warning-100 flex h-10 w-10 items-center justify-center rounded-lg">
              <Shield size={18} className="text-warning-600" />
            </div>
            <div>
              <p className="text-text-muted text-xs">Updates</p>
              <p className="text-warning-600 text-xl font-bold">{stats.updates}</p>
            </div>
          </div>
        </Card>
        <Card padding="sm">
          <div className="flex items-center gap-3">
            <div className="bg-error-100 flex h-10 w-10 items-center justify-center rounded-lg">
              <X size={18} className="text-error-600" />
            </div>
            <div>
              <p className="text-text-muted text-xs">Deletes</p>
              <p className="text-error-600 text-xl font-bold">{stats.deletes}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filter Bar */}
      <div className="border-border-default bg-bg-surface flex flex-wrap items-end gap-3 rounded-lg border p-4">
        <div className="w-40">
          <Select
            label="Action"
            options={ACTION_OPTIONS}
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            size="sm"
          />
        </div>
        <div className="w-44">
          <Select
            label="Entity Type"
            options={ENTITY_OPTIONS}
            value={entityFilter}
            onChange={(e) => setEntityFilter(e.target.value)}
            size="sm"
          />
        </div>
        <div className="w-48">
          <label className="text-text-secondary mb-1.5 block text-sm font-medium">User</label>
          <SearchInput
            value={userSearch}
            onChange={setUserSearch}
            placeholder="Search user..."
            historyKey="audit-users"
          />
        </div>
        <div className="w-40">
          <label className="text-text-secondary mb-1.5 block text-sm font-medium">From</label>
          <CalendarDatePicker value={dateFrom} onChange={setDateFrom} size="sm" />
        </div>
        <div className="w-40">
          <label className="text-text-secondary mb-1.5 block text-sm font-medium">To</label>
          <CalendarDatePicker value={dateTo} onChange={setDateTo} size="sm" />
        </div>
        <Button leftIcon={Filter} onClick={applyFilters} size="sm">
          Apply Filters
        </Button>
        <Button leftIcon={X} variant="outline" onClick={clearFilters} size="sm">
          Clear
        </Button>
      </div>

      {/* Table */}
      <DataTable<AuditEntry>
        columns={columns}
        data={sortedEntries}
        loading={loading}
        emptyIcon={ScrollText}
        emptyTitle="No audit logs found"
        emptyDescription="Adjust your filters or check back later."
        sortKey={sortKey}
        sortDir={sortDir}
        onSort={handleSort}
        onExport={handleTableExport}
        stickyHeader
        page={page}
        totalPages={totalPages}
        total={data?.meta?.total}
        pageSize={DEFAULT_LARGE_PAGE_SIZE}
        onPageChange={setPage}
        onRowClick={(row) => setDetailEntry(detailEntry?.id === row.id ? null : row)}
        viewType={viewType}
        onViewTypeChange={setViewType}
        cardRenderer={cardRenderer}
        enableColumnVisibility
        density={density}
        onDensityChange={setDensity}
        pinnedIds={pinnedIds}
        onPinChange={setPinnedIds}
        detailRenderer={cardDetailRenderer}
        detailTitle={(r) => `${r.action} — ${r.entityType.replace(/_/g, " ")}`}
        enableKeyboardNav
      />

      {/* Detail Modal */}
      <Modal
        open={!!detailEntry}
        onClose={() => setDetailEntry(null)}
        title="Change Details"
        description={
          detailEntry
            ? `${detailEntry.action} on ${detailEntry.entityType.replace(/_/g, " ")} by ${detailEntry.userName}`
            : undefined
        }
        size="lg"
      >
        {detailEntry && renderChanges(detailEntry.changes)}
      </Modal>
    </div>
  );
}
