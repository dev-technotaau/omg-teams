"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Trash2, Monitor, RefreshCw, Users, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { api, extractApiError } from "@/lib/api";
import { listSessions, revokeSession, revokeUserSessions } from "@/services/session-admin.service";
import type { AdminSession } from "@/services/session-admin.service";
import {
  PageHeader,
  Button,
  IconButton,
  SearchInput,
  DataTable,
  Badge,
  ConfirmDialog,
  Card,
  Tooltip,
} from "@/components/ui";
import type { Column, ViewType, RowDensity } from "@/components/ui";
import { formatDateTime } from "@/utils/date";
import { exportToXLSX } from "@/utils/export-table";
import { ROLES } from "@/constants/roles";
import { DEFAULT_LARGE_PAGE_SIZE } from "@/constants/pagination";
import { ROLE_BADGE_VARIANT } from "@/constants/statuses";
import { timeAgo } from "@/utils/date";

// ──────────────────────────────────────────────
//  Session Management — Spec Section 4
//  View active sessions, revoke individual/user/all
// ──────────────────────────────────────────────

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const relativeTime = timeAgo;

export default function SessionManagementPage() {
  const [sessions, setSessions] = useState<AdminSession[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [confirmAction, setConfirmAction] = useState<{
    type: "revoke" | "revokeUser" | "revokeAll";
    id?: string;
    userId?: string;
    userName?: string;
  } | null>(null);
  const [sortKey, setSortKey] = useState("");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [viewType, setViewType] = useState<ViewType>("table");
  const [density, setDensity] = useState<RowDensity>("default");
  const intervalRef = useRef<ReturnType<typeof setInterval>>(null);

  const fetchSessions = useCallback(async () => {
    try {
      const result = await listSessions({
        page,
        limit: DEFAULT_LARGE_PAGE_SIZE,
        ...(sortKey ? { sortBy: sortKey, sortDir } : {}),
      });
      setSessions(result.data);
      setPagination(result.pagination);
    } catch (err) {
      toast.error(extractApiError(err).message);
    } finally {
      setIsLoading(false);
    }
  }, [page, sortKey, sortDir]);

  useEffect(() => {
    setIsLoading(true);
    void fetchSessions();
  }, [fetchSessions]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      void fetchSessions();
    }, 30_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchSessions]);

  const handleConfirmAction = async () => {
    if (!confirmAction) return;
    try {
      if (confirmAction.type === "revoke") {
        await revokeSession(confirmAction.id!);
        toast.success("Session revoked");
      } else if (confirmAction.type === "revokeUser") {
        await revokeUserSessions(confirmAction.userId!);
        toast.success(`All sessions revoked for ${confirmAction.userName}`);
      } else {
        await api.delete("/admin/sessions");
        toast.success("All sessions revoked");
      }
      void fetchSessions();
    } catch (err) {
      toast.error(extractApiError(err).message);
    }
    setConfirmAction(null);
  };

  const handleSort = useCallback(
    (key: string | null, dir: "asc" | "desc" | null) => {
      setSortKey(key ?? "");
      setSortDir(dir ?? "asc");
    },
    [],
  );

  const handleExport = useCallback(() => {
    exportToXLSX(
      sessions,
      [
        { header: "User", accessor: (s) => `${s.user.firstName} ${s.user.lastName}` },
        { header: "Role", accessor: (s) => s.user.role.replace("_", " ") },
        { header: "Device", accessor: (s) => s.deviceId },
        { header: "IP", accessor: (s) => s.ipAddress ?? "" },
        { header: "Created", accessor: (s) => formatDateTime(s.createdAt) },
        { header: "Last Active", accessor: (s) => formatDateTime(s.lastActiveAt) },
        { header: "Status", accessor: () => "Active" },
      ],
      "active-sessions",
    );
  }, [sessions]);

  const sortedSessions = useMemo(() => {
    if (!sortKey) return sessions;
    const sorted = [...sessions].sort((a, b) => {
      let aVal: string | number = "";
      let bVal: string | number = "";
      switch (sortKey) {
        case "user":
          aVal = `${a.user.firstName} ${a.user.lastName}`.toLowerCase();
          bVal = `${b.user.firstName} ${b.user.lastName}`.toLowerCase();
          break;
        case "role":
          aVal = a.user.role;
          bVal = b.user.role;
          break;
        case "createdAt":
          aVal = new Date(a.createdAt).getTime();
          bVal = new Date(b.createdAt).getTime();
          break;
        case "lastActiveAt":
          aVal = new Date(a.lastActiveAt).getTime();
          bVal = new Date(b.lastActiveAt).getTime();
          break;
        default:
          return 0;
      }
      if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [sessions, sortKey, sortDir]);

  // Summary counts
  const activeCount = pagination?.total ?? 0;
  const recruitersOnline = sessions.filter((s) => s.user.role === ROLES.RECRUITER).length;
  const managersOnline = sessions.filter((s) => s.user.role === ROLES.REPORTING_MANAGER).length;

  // DataTable columns
  const columns: Column<AdminSession>[] = [
    {
      key: "user",
      header: "User",
      sortable: true,
      cell: (s) => (
        <div>
          <p className="text-text-primary font-medium">
            {s.user.firstName} {s.user.lastName}
          </p>
          <p className="text-text-muted font-mono text-xs">{s.user.employeeId}</p>
        </div>
      ),
    },
    {
      key: "role",
      header: "Role",
      sortable: true,
      cell: (s) => (
        <Badge variant={ROLE_BADGE_VARIANT[s.user.role] ?? "default"}>
          {s.user.role.replace("_", " ")}
        </Badge>
      ),
    },
    {
      key: "deviceId",
      header: "Device ID",
      cell: (s) => (
        <span className="text-text-secondary font-mono text-xs" title={s.deviceId}>
          {s.deviceId.slice(0, 12)}...
        </span>
      ),
    },
    {
      key: "ipAddress",
      header: "IP Address",
      sortable: true,
      cell: (s) => <span className="text-text-secondary">{s.ipAddress ?? "—"}</span>,
    },
    {
      key: "userAgent",
      header: "User Agent",
      cell: (s) => (
        <p
          className="text-text-secondary max-w-[200px] truncate text-xs"
          title={s.userAgent ?? undefined}
        >
          {s.userAgent ?? "—"}
        </p>
      ),
    },
    {
      key: "createdAt",
      header: "Created At",
      sortable: true,
      cell: (s) => (
        <span className="text-text-secondary text-xs">{formatDateTime(s.createdAt)}</span>
      ),
    },
    {
      key: "lastActiveAt",
      header: "Last Active",
      sortable: true,
      cell: (s) => (
        <span className="text-text-secondary text-xs">{relativeTime(s.lastActiveAt)}</span>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      cell: (s) => (
        <div className="flex gap-1">
          <Tooltip content="Revoke session">
            <IconButton
              icon={Trash2}
              aria-label="Revoke session"
              size="sm"
              variant="danger"
              onClick={() =>
                setConfirmAction({
                  type: "revoke",
                  id: s.id,
                  userName: `${s.user.firstName} ${s.user.lastName}`,
                })
              }
            />
          </Tooltip>
          <Tooltip content="Revoke all sessions for this user">
            <IconButton
              icon={Users}
              aria-label="Revoke all sessions for this user"
              size="sm"
              variant="ghost"
              className="text-warning-700 hover:bg-warning-100"
              onClick={() =>
                setConfirmAction({
                  type: "revokeUser",
                  userId: s.userId,
                  userName: `${s.user.firstName} ${s.user.lastName}`,
                })
              }
            />
          </Tooltip>
        </div>
      ),
    },
  ];

  const cardRenderer = useCallback(
    (s: AdminSession) => (
      <Card padding="sm" className="transition-shadow hover:shadow-md">
        <div className="space-y-2">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-text-primary font-medium">
                {s.user.firstName} {s.user.lastName}
              </p>
              <p className="text-text-muted font-mono text-xs">{s.user.employeeId}</p>
            </div>
            <Badge variant={ROLE_BADGE_VARIANT[s.user.role] ?? "default"}>
              {s.user.role.replace("_", " ")}
            </Badge>
          </div>
          <div className="text-text-muted space-y-1 text-xs">
            <div>
              Device: <span className="font-mono">{s.deviceId.slice(0, 16)}…</span>
            </div>
            <div>IP: {s.ipAddress ?? "—"}</div>
          </div>
          <div className="border-border-default flex items-center justify-between border-t pt-2 text-xs">
            <span className="text-text-muted">{relativeTime(s.lastActiveAt)}</span>
            <div className="flex gap-1">
              <Tooltip content="Revoke">
                <IconButton
                  icon={Trash2}
                  aria-label="Revoke"
                  size="sm"
                  variant="danger"
                  onClick={() =>
                    setConfirmAction({
                      type: "revoke",
                      id: s.id,
                      userName: `${s.user.firstName} ${s.user.lastName}`,
                    })
                  }
                />
              </Tooltip>
            </div>
          </div>
        </div>
      </Card>
    ),
    [],
  );

  const sessionDetailRenderer = useCallback(
    (s: AdminSession) => (
      <div className="space-y-4">
        <div>
          <p className="text-text-primary text-lg font-semibold">
            {s.user.firstName} {s.user.lastName}
          </p>
          <p className="text-text-muted text-sm">
            {s.user.employeeId} &middot; {s.user.role.replace("_", " ")}
          </p>
        </div>
        <div className="border-border-default divide-border-default divide-y rounded-lg border">
          {[
            ["Device ID", s.deviceId],
            ["IP Address", s.ipAddress ?? "\u2014"],
            ["User Agent", s.userAgent ?? "\u2014"],
            ["Created", formatDateTime(s.createdAt)],
            ["Last Active", relativeTime(s.lastActiveAt)],
          ].map(([label, value]) => (
            <div key={String(label)} className="flex justify-between px-4 py-2.5 text-sm">
              <span className="text-text-muted">{label}</span>
              <span className="text-text-primary max-w-[200px] truncate font-medium">{value}</span>
            </div>
          ))}
        </div>
      </div>
    ),
    [],
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <PageHeader
        title="Session Management"
        actions={
          <Button
            variant="danger"
            leftIcon={Trash2}
            onClick={() => setConfirmAction({ type: "revokeAll" })}
          >
            Revoke All Sessions
          </Button>
        }
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card padding="sm">
          <div className="flex items-center gap-3">
            <div className="bg-primary-100 flex h-10 w-10 items-center justify-center rounded-lg">
              <Monitor size={18} className="text-primary-600" />
            </div>
            <div>
              <p className="text-text-muted text-xs">Active Sessions</p>
              <p className="text-text-primary text-xl font-bold">{activeCount}</p>
            </div>
          </div>
        </Card>
        <Card padding="sm">
          <div className="flex items-center gap-3">
            <div className="bg-success-100 flex h-10 w-10 items-center justify-center rounded-lg">
              <Users size={18} className="text-success-600" />
            </div>
            <div>
              <p className="text-text-muted text-xs">Recruiters Online</p>
              <p className="text-success-600 text-xl font-bold">{recruitersOnline}</p>
            </div>
          </div>
        </Card>
        <Card padding="sm">
          <div className="flex items-center gap-3">
            <div className="bg-warning-100 flex h-10 w-10 items-center justify-center rounded-lg">
              <ShieldCheck size={18} className="text-warning-600" />
            </div>
            <div>
              <p className="text-text-muted text-xs">Managers Online</p>
              <p className="text-warning-600 text-xl font-bold">{managersOnline}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filter */}
      <div className="flex flex-wrap items-center gap-3">
        <SearchInput
          value={search}
          historyKey="sessions"
          onChange={(value) => {
            setSearch(value);
            setPage(1);
          }}
          placeholder="Search by name or Employee ID..."
          className="max-w-sm flex-1"
        />
        <Button
          variant="outline"
          leftIcon={RefreshCw}
          onClick={() => {
            setIsLoading(true);
            void fetchSessions();
          }}
        >
          Refresh
        </Button>
      </div>

      {/* Table */}
      <DataTable<AdminSession>
        columns={columns}
        data={sortedSessions}
        loading={isLoading}
        emptyIcon={Monitor}
        emptyTitle="No active sessions"
        emptyDescription="There are no active sessions matching your criteria."
        sortKey={sortKey}
        sortDir={sortDir}
        onSort={handleSort}
        onExport={handleExport}
        stickyHeader
        page={page}
        totalPages={pagination?.totalPages ?? 1}
        total={pagination?.total}
        pageSize={DEFAULT_LARGE_PAGE_SIZE}
        onPageChange={setPage}
        viewType={viewType}
        onViewTypeChange={setViewType}
        cardRenderer={cardRenderer}
        enableColumnVisibility
        density={density}
        onDensityChange={setDensity}
        detailRenderer={sessionDetailRenderer}
        detailTitle={(s) => `${s.user.firstName} ${s.user.lastName}`}
        enableKeyboardNav
      />

      {/* Confirm Dialog */}
      <ConfirmDialog
        open={!!confirmAction}
        onClose={() => setConfirmAction(null)}
        onConfirm={handleConfirmAction}
        title={
          confirmAction?.type === "revokeAll"
            ? "Revoke All Sessions"
            : confirmAction?.type === "revokeUser"
              ? "Revoke User Sessions"
              : "Revoke Session"
        }
        description={
          confirmAction?.type === "revokeAll"
            ? "Are you sure you want to revoke ALL active sessions? All users will be logged out."
            : confirmAction?.type === "revokeUser"
              ? `Are you sure you want to revoke all sessions for ${confirmAction.userName}?`
              : `Are you sure you want to revoke this session for ${confirmAction?.userName}?`
        }
        confirmLabel="Revoke"
        variant="danger"
      />
    </div>
  );
}
