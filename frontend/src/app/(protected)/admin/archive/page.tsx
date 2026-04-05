"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Archive, RotateCcw, Trash2, Play, FileText, Clock, Bell, Database } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { exportToXLSX } from "@/utils/export-table";
import {
  PageHeader,
  DataTable,
  Badge,
  Button,
  IconButton,
  SearchInput,
  Card,
  Tooltip,
} from "@/components/ui";
import type { Column, ViewType, RowDensity } from "@/components/ui";
import { cn } from "@/lib/utils";

// ──────────────────────────────────────────────
//  Admin Archive — Spec Section 23.5
//  View, restore, and manage archived records
// ──────────────────────────────────────────────

interface ArchivedRecord {
  id: string;
  entityType: string;
  entityId: string;
  snapshot: Record<string, unknown>;
  archivedAt: string;
}

interface ArchiveStat {
  entityType: string;
  count: number;
}

const ENTITY_TYPES = [
  "",
  "CANDIDATE_REPORT",
  "AUDIT_LOG",
  "LOGIN_HISTORY",
  "NOTIFICATION",
] as const;
const ENTITY_LABELS: Record<string, string> = {
  CANDIDATE_REPORT: "Candidate Reports",
  AUDIT_LOG: "Audit Logs",
  LOGIN_HISTORY: "Login History",
  NOTIFICATION: "Notifications",
};

export default function ArchivePage() {
  const [data, setData] = useState<ArchivedRecord[]>([]);
  const [stats, setStats] = useState<ArchiveStat[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [entityFilter, setEntityFilter] = useState("");
  const [search, setSearch] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [sortKey, setSortKey] = useState("");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [viewType, setViewType] = useState<ViewType>("table");
  const [density, setDensity] = useState<RowDensity>("default");

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const params: Record<string, string> = { page: String(page), limit: "25" };
      if (entityFilter) params["entityType"] = entityFilter;
      if (search) params["search"] = search;
      const res = await api.get<{
        data: ArchivedRecord[];
        pagination: { page: number; totalPages: number; total: number };
      }>("/archive", { params });
      setData(res.data.data);
      setTotalPages(res.data.pagination.totalPages);
      setTotal(res.data.pagination.total);
    } finally {
      setIsLoading(false);
    }
  }, [page, entityFilter, search]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await api.get<{ stats: ArchiveStat[] }>("/archive/stats");
      setStats(res.data.stats);
    } catch {
      /* silent */
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);
  useEffect(() => {
    void fetchStats();
  }, [fetchStats]);

  const handleRestore = useCallback(
    async (id: string) => {
      try {
        await api.post(`/archive/${id}/restore`);
        toast.success("Record restored");
        void fetchData();
        void fetchStats();
      } catch {
        toast.error("Restore failed");
      }
    },
    [fetchData, fetchStats],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        await api.delete(`/archive/${id}`);
        toast.success("Record permanently deleted");
        void fetchData();
        void fetchStats();
      } catch {
        toast.error("Delete failed");
      }
    },
    [fetchData, fetchStats],
  );

  const handleRunArchiving = async () => {
    setIsRunning(true);
    try {
      const res = await api.post<{ archived: Record<string, number> }>("/archive/run");
      const total = Object.values(res.data.archived).reduce((sum, n) => sum + n, 0);
      toast.success(`Archiving complete: ${total} records archived`);
      void fetchData();
      void fetchStats();
    } catch {
      toast.error("Archiving failed");
    } finally {
      setIsRunning(false);
    }
  };

  const handleSort = useCallback(
    (key: string) => {
      setSortDir((prev) => (sortKey === key && prev === "asc" ? "desc" : "asc"));
      setSortKey(key);
    },
    [sortKey],
  );

  const handleExport = useCallback(() => {
    exportToXLSX(
      data,
      [
        { header: "Entity Type", accessor: (r) => ENTITY_LABELS[r.entityType] ?? r.entityType },
        { header: "Entity ID", accessor: (r) => r.entityId },
        {
          header: "Archived At",
          accessor: (r) => new Date(r.archivedAt).toLocaleDateString("en-IN"),
        },
      ],
      "archive-export",
    );
  }, [data]);

  const sortedData = useMemo(() => {
    if (!sortKey) return data;
    const sorted = [...data].sort((a, b) => {
      let aVal: string | number = "";
      let bVal: string | number = "";
      switch (sortKey) {
        case "entityType":
          aVal = a.entityType.toLowerCase();
          bVal = b.entityType.toLowerCase();
          break;
        case "archivedAt":
          aVal = new Date(a.archivedAt).getTime();
          bVal = new Date(b.archivedAt).getTime();
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

  const getSnapshotLabel = (record: ArchivedRecord): string => {
    const s = record.snapshot;
    if (record.entityType === "CANDIDATE_REPORT")
      return String(s["candidateName"] ?? s["contactNo"] ?? record.entityId);
    if (record.entityType === "AUDIT_LOG")
      return `${s["action"] ?? ""} ${s["entityType"] ?? ""}`.trim() || record.entityId;
    if (record.entityType === "NOTIFICATION") return String(s["title"] ?? record.entityId);
    return record.entityId;
  };

  const columns: Column<ArchivedRecord>[] = [
    {
      key: "entityType",
      header: "Type",
      sortable: true,
      cell: (r) => (
        <Badge variant="default" size="sm">
          {ENTITY_LABELS[r.entityType] ?? r.entityType}
        </Badge>
      ),
    },
    {
      key: "entityId",
      header: "Record",
      cell: (r) => <span className="text-text-primary text-sm">{getSnapshotLabel(r)}</span>,
    },
    {
      key: "entityId_raw",
      header: "ID",
      cell: (r) => (
        <span className="text-text-muted font-mono text-xs">{r.entityId.slice(0, 12)}…</span>
      ),
    },
    {
      key: "archivedAt",
      header: "Archived",
      sortable: true,
      cell: (r) => (
        <span className="text-text-muted text-xs">
          {new Date(r.archivedAt).toLocaleDateString("en-IN")}
        </span>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      cell: (r) => (
        <div className="flex items-center justify-end gap-1">
          <Tooltip content="Restore">
            <IconButton
              icon={RotateCcw}
              aria-label="Restore"
              variant="ghost"
              size="sm"
              onClick={() => void handleRestore(r.id)}
            />
          </Tooltip>
          <Tooltip content="Delete permanently">
            <IconButton
              icon={Trash2}
              aria-label="Delete permanently"
              variant="ghost"
              size="sm"
              onClick={() => void handleDelete(r.id)}
            />
          </Tooltip>
        </div>
      ),
    },
  ];

  const cardRenderer = useCallback(
    (r: ArchivedRecord) => (
      <Card padding="sm" className="transition-shadow hover:shadow-md">
        <div className="space-y-2">
          <div className="flex items-start justify-between">
            <p className="text-text-primary text-sm font-medium">{getSnapshotLabel(r)}</p>
            <Badge variant="default" size="sm">
              {ENTITY_LABELS[r.entityType] ?? r.entityType}
            </Badge>
          </div>
          <div className="text-text-muted font-mono text-xs">{r.entityId.slice(0, 12)}…</div>
          <div className="border-border-default flex items-center justify-between border-t pt-2 text-xs">
            <span className="text-text-muted">
              {new Date(r.archivedAt).toLocaleDateString("en-IN")}
            </span>
            <div className="flex gap-1">
              <Tooltip content="Restore">
                <IconButton
                  icon={RotateCcw}
                  aria-label="Restore"
                  variant="ghost"
                  size="sm"
                  onClick={() => void handleRestore(r.id)}
                />
              </Tooltip>
              <Tooltip content="Delete">
                <IconButton
                  icon={Trash2}
                  aria-label="Delete"
                  variant="ghost"
                  size="sm"
                  onClick={() => void handleDelete(r.id)}
                />
              </Tooltip>
            </div>
          </div>
        </div>
      </Card>
    ),
    [handleDelete, handleRestore],
  );

  const archiveDetailRenderer = useCallback(
    (r: ArchivedRecord) => (
      <div className="space-y-4">
        <p className="text-text-primary text-lg font-semibold">{getSnapshotLabel(r)}</p>
        <div className="border-border-default divide-border-default divide-y rounded-lg border">
          {[
            ["Type", ENTITY_LABELS[r.entityType] ?? r.entityType],
            ["Entity ID", r.entityId],
            ["Archived At", new Date(r.archivedAt).toLocaleDateString("en-IN")],
          ].map(([label, value]) => (
            <div key={String(label)} className="flex justify-between px-4 py-2.5 text-sm">
              <span className="text-text-muted">{label}</span>
              <span className="text-text-primary font-medium">{value}</span>
            </div>
          ))}
        </div>
        {r.snapshot && (
          <details className="text-xs">
            <summary className="text-text-muted cursor-pointer">View snapshot data</summary>
            <pre className="bg-bg-muted mt-2 overflow-auto rounded-lg p-3 text-[10px]">
              {JSON.stringify(r.snapshot, null, 2)}
            </pre>
          </details>
        )}
      </div>
    ),
    [],
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Archive"
        description="Aged records moved from primary tables for performance"
        actions={
          <Button
            variant="outline"
            size="sm"
            leftIcon={Play}
            onClick={() => void handleRunArchiving()}
            disabled={isRunning}
          >
            {isRunning ? "Running…" : "Run Archiving Now"}
          </Button>
        }
      />

      {/* Stats cards */}
      {stats.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {stats.map((s) => (
            <Card key={s.entityType} padding="sm">
              <div className="flex items-center gap-3">
                <div className="bg-primary-100 flex h-10 w-10 items-center justify-center rounded-lg">
                  {s.entityType === "CANDIDATE_REPORT" ? (
                    <FileText size={18} className="text-primary-600" />
                  ) : s.entityType === "AUDIT_LOG" ? (
                    <Database size={18} className="text-primary-600" />
                  ) : s.entityType === "LOGIN_HISTORY" ? (
                    <Clock size={18} className="text-primary-600" />
                  ) : (
                    <Bell size={18} className="text-primary-600" />
                  )}
                </div>
                <div>
                  <p className="text-text-muted text-xs">
                    {ENTITY_LABELS[s.entityType] ?? s.entityType}
                  </p>
                  <p className="text-text-primary text-xl font-bold">{s.count.toLocaleString()}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Search + Entity type filter */}
      <div className="flex flex-wrap items-center gap-3">
        <SearchInput
          value={search}
          onChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          placeholder="Search archived records..."
          historyKey="archive"
          className="max-w-sm flex-1"
        />
      </div>
      <div className="border-border-default bg-bg-muted flex w-fit gap-1 rounded-lg border p-1">
        {ENTITY_TYPES.map((et) => (
          <button
            key={et || "all"}
            onClick={() => {
              setEntityFilter(et);
              setPage(1);
            }}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              entityFilter === et ? "bg-bg-surface text-text-primary shadow-xs" : "text-text-muted",
            )}
          >
            {et ? (ENTITY_LABELS[et] ?? et) : "All"}
          </button>
        ))}
      </div>

      <DataTable
        columns={columns}
        data={sortedData}
        loading={isLoading}
        emptyIcon={Archive}
        emptyTitle="No archived records"
        emptyDescription="Archiving runs monthly or can be triggered manually."
        sortKey={sortKey}
        sortDir={sortDir}
        onSort={handleSort}
        onExport={handleExport}
        stickyHeader
        page={page}
        totalPages={totalPages}
        total={total}
        pageSize={25}
        onPageChange={setPage}
        viewType={viewType}
        onViewTypeChange={setViewType}
        cardRenderer={cardRenderer}
        enableColumnVisibility
        density={density}
        onDensityChange={setDensity}
        detailRenderer={archiveDetailRenderer}
        detailTitle={(r) => getSnapshotLabel(r)}
        enableKeyboardNav
      />
    </div>
  );
}
