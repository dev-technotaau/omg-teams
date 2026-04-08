"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { Trash2, Monitor, RefreshCw, Users, ShieldCheck, History } from "lucide-react";
import { toast } from "sonner";
import { api, extractApiError } from "@/lib/api";
import { listSessions, revokeSession, revokeUserSessions } from "@/services/session-admin.service";
import type {
  AdminSession,
  SessionSummary,
  SessionRoleFilter,
  SessionView,
} from "@/services/session-admin.service";
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
  Tabs,
} from "@/components/ui";
import type { Column, ViewType, RowDensity } from "@/components/ui";
import { formatDateTime } from "@/utils/date";
import { exportToXLSX } from "@/utils/export-table";
import { DEFAULT_LARGE_PAGE_SIZE } from "@/constants/pagination";
import { ROLE_BADGE_VARIANT } from "@/constants/statuses";
import { timeAgo } from "@/utils/date";
import { useTabSearchParam } from "@/hooks";

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
  const [summary, setSummary] = useState<SessionSummary>({
    total: 0,
    admins: 0,
    recruiters: 0,
    managers: 0,
  });
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  // Tab state in URL: ?view=active|history & ?role=ADMIN|EMPLOYEE
  // Survives reloads, browser back/forward, and link sharing.
  const [viewMode, setViewModeRaw] = useTabSearchParam<SessionView>("view", "active", [
    "active",
    "history",
  ]);
  const [roleFilter, setRoleFilterRaw] = useTabSearchParam<SessionRoleFilter>("role", "", [
    "",
    "ADMIN",
    "EMPLOYEE",
  ]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [confirmAction, setConfirmAction] = useState<{
    type: "revoke" | "revokeUser" | "revokeAll" | "bulkRevoke";
    id?: string;
    userId?: string;
    userName?: string;
    ids?: Set<string>;
  } | null>(null);
  const [sortKey, setSortKey] = useState("");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [viewType, setViewType] = useState<ViewType>("table");
  const [density, setDensity] = useState<RowDensity>("default");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const intervalRef = useRef<ReturnType<typeof setInterval>>(null);

  const qc = useQueryClient();
  const sessionsQuery = useQuery({
    queryKey: ["admin-sessions", { page, viewMode, roleFilter, sortKey, sortDir }] as const,
    queryFn: () =>
      listSessions({
        page,
        limit: DEFAULT_LARGE_PAGE_SIZE,
        view: viewMode,
        ...(roleFilter ? { role: roleFilter } : {}),
        ...(sortKey ? { sortBy: sortKey, sortDir } : {}),
      }),
    placeholderData: keepPreviousData,
    refetchInterval: 30_000,
  });
  useEffect(() => {
    if (sessionsQuery.data) {
      // reason: bridging react-query result into pre-existing per-piece state
      /* eslint-disable react-hooks/set-state-in-effect */
      setSessions(sessionsQuery.data.data);
      setPagination(sessionsQuery.data.pagination);
      setSummary(sessionsQuery.data.summary);
      setCurrentSessionId(sessionsQuery.data.currentSessionId);
      setIsLoading(false);
      /* eslint-enable react-hooks/set-state-in-effect */
    }
    if (sessionsQuery.isError) toast.error(extractApiError(sessionsQuery.error).message);
  }, [sessionsQuery.data, sessionsQuery.isError, sessionsQuery.error]);
  const fetchSessions = useCallback(
    () => qc.invalidateQueries({ queryKey: ["admin-sessions"] }),
    [qc],
  );
  void intervalRef;

  const handleConfirmAction = async () => {
    if (!confirmAction) return;
    try {
      if (confirmAction.type === "revoke") {
        await revokeSession(confirmAction.id!);
        toast.success("Session revoked");
      } else if (confirmAction.type === "revokeUser") {
        await revokeUserSessions(confirmAction.userId!);
        toast.success(`All sessions revoked for ${confirmAction.userName}`);
      } else if (confirmAction.type === "bulkRevoke") {
        const ids = confirmAction.ids ?? new Set<string>();
        for (const id of ids) await revokeSession(id);
        toast.success(`${ids.size} session${ids.size === 1 ? "" : "s"} revoked`);
        setSelectedIds(new Set());
      } else {
        // Revoke all OTHER sessions — backend keeps the caller's
        // own session alive so the admin doesn't get logged out.
        const res = await api.delete<{
          message: string;
          revoked: number;
          affectedUsers: number;
        }>("/admin/sessions");
        const { revoked = 0, affectedUsers = 0 } = res.data ?? {};
        toast.success(
          revoked === 0
            ? "No other sessions to revoke"
            : `Revoked ${revoked} session${revoked === 1 ? "" : "s"} ` +
                `across ${affectedUsers} user${affectedUsers === 1 ? "" : "s"}`,
        );
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

  // Summary counts — driven by the API's global summary so they
  // reflect everyone, regardless of which tab is selected.
  const activeCount = summary.total;
  const adminsOnline = summary.admins;
  const employeesOnline = summary.recruiters + summary.managers;

  // DataTable columns — branch on viewMode. Active view shows the
  // revoke actions column; history view shows Status + Ended-at and
  // hides the actions (rows are already terminated).
  const columns = useMemo<Column<AdminSession>[]>(() => {
    const base: Column<AdminSession>[] = [
      {
        key: "user",
        header: "User",
        sortable: true,
        cell: (s) => (
          <div>
            <div className="flex items-center gap-2">
              <p className="text-text-primary font-medium">
                {s.user.firstName} {s.user.lastName}
              </p>
              {viewMode === "active" && s.token === currentSessionId && (
                <Badge variant="success" size="sm">
                  This session
                </Badge>
              )}
            </div>
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
    ];

    if (viewMode === "history") {
      base.push(
        {
          key: "status",
          header: "Ended By",
          cell: (s) =>
            s.revokedAt ? (
              <Badge variant="danger" size="sm">
                Logged out / Revoked
              </Badge>
            ) : (
              <Badge variant="warning" size="sm">
                Idle timeout
              </Badge>
            ),
        },
        {
          key: "revokedAt",
          header: "Ended At",
          sortable: true,
          cell: (s) => (
            <span className="text-text-secondary text-xs">
              {/* Explicit revoke time wins; otherwise the row was idled
                  out and lastActiveAt is the closest proxy for "ended". */}
              {formatDateTime(s.revokedAt ?? s.lastActiveAt)}
            </span>
          ),
        },
      );
      return base;
    }

    base.push({
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
    });
    return base;
  }, [viewMode, currentSessionId]);

  const cardRenderer = useCallback(
    (s: AdminSession) => (
      <Card padding="sm" className="transition-shadow hover:shadow-md">
        <div className="space-y-2">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <p className="text-text-primary font-medium">
                  {s.user.firstName} {s.user.lastName}
                </p>
                {viewMode === "active" && s.token === currentSessionId && (
                  <Badge variant="success" size="sm">
                    This session
                  </Badge>
                )}
                {viewMode === "history" &&
                  (s.revokedAt ? (
                    <Badge variant="danger" size="sm">
                      Logged out
                    </Badge>
                  ) : (
                    <Badge variant="warning" size="sm">
                      Idle timeout
                    </Badge>
                  ))}
              </div>
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
            {viewMode === "history" && (
              <div>Ended: {formatDateTime(s.revokedAt ?? s.lastActiveAt)}</div>
            )}
          </div>
          <div className="border-border-default flex items-center justify-between border-t pt-2 text-xs">
            <span className="text-text-muted">{relativeTime(s.lastActiveAt)}</span>
            {viewMode === "active" && (
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
            )}
          </div>
        </div>
      </Card>
    ),
    [currentSessionId, viewMode],
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
          viewMode === "active" ? (
            <Button
              variant="danger"
              leftIcon={Trash2}
              onClick={() => setConfirmAction({ type: "revokeAll" })}
            >
              Revoke All Other Sessions
            </Button>
          ) : undefined
        }
      />

      {/* Summary Cards — global counts (not affected by the role tab) */}
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
            <div className="bg-warning-100 flex h-10 w-10 items-center justify-center rounded-lg">
              <ShieldCheck size={18} className="text-warning-600" />
            </div>
            <div>
              <p className="text-text-muted text-xs">Admins Online</p>
              <p className="text-warning-600 text-xl font-bold">{adminsOnline}</p>
            </div>
          </div>
        </Card>
        <Card padding="sm">
          <div className="flex items-center gap-3">
            <div className="bg-success-100 flex h-10 w-10 items-center justify-center rounded-lg">
              <Users size={18} className="text-success-600" />
            </div>
            <div>
              <p className="text-text-muted text-xs">Employees Online</p>
              <p className="text-success-600 text-xl font-bold">{employeesOnline}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* View tabs — Active (currently online) vs History (logged-out / idled-out) */}
      <Tabs
        tabs={[
          { id: "active", label: "Active", icon: Monitor },
          { id: "history", label: "History", icon: History },
        ]}
        activeTab={viewMode}
        onChange={(tabId) => {
          setViewModeRaw(tabId as SessionView);
          setPage(1);
          setSelectedIds(new Set());
          setSortKey("");
        }}
        variant="pills"
      />

      {/* Role tabs — splits admin sessions from employee sessions */}
      <Tabs
        tabs={[
          {
            id: "",
            label: "All",
            ...(viewMode === "active" ? { badge: summary.total } : {}),
          },
          {
            id: "ADMIN",
            label: "Admins",
            ...(viewMode === "active" ? { badge: summary.admins } : {}),
          },
          {
            id: "EMPLOYEE",
            label: "Employees",
            ...(viewMode === "active"
              ? { badge: summary.recruiters + summary.managers }
              : {}),
          },
        ]}
        activeTab={roleFilter}
        onChange={(tabId) => {
          setRoleFilterRaw(tabId as SessionRoleFilter);
          setPage(1);
          setSelectedIds(new Set());
        }}
      />

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
        emptyIcon={viewMode === "history" ? History : Monitor}
        emptyTitle={viewMode === "history" ? "No past sessions" : "No active sessions"}
        emptyDescription={
          viewMode === "history"
            ? "No sessions have ended yet for the current filter."
            : "There are no active sessions matching your criteria."
        }
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
        // Selection + bulk actions — only in active view. History
        // rows are already terminated, so revoke would be a no-op.
        {...(viewMode === "active"
          ? {
              selectable: true as const,
              selectedIds,
              onSelectionChange: setSelectedIds,
              getRowId: (s: AdminSession) => s.id,
              bulkActions: [
                {
                  label: "Revoke Selected",
                  icon: Trash2,
                  variant: "danger" as const,
                  onClick: (ids: Set<string>) =>
                    setConfirmAction({ type: "bulkRevoke", ids: new Set(ids) }),
                },
              ],
            }
          : {})}
      />

      {/* Confirm Dialog */}
      <ConfirmDialog
        open={!!confirmAction}
        onClose={() => setConfirmAction(null)}
        onConfirm={handleConfirmAction}
        title={
          confirmAction?.type === "revokeAll"
            ? "Revoke All Other Sessions"
            : confirmAction?.type === "revokeUser"
              ? "Revoke User Sessions"
              : confirmAction?.type === "bulkRevoke"
                ? "Revoke Selected Sessions"
                : "Revoke Session"
        }
        description={
          confirmAction?.type === "revokeAll"
            ? "This will log out every user (admins and employees) except you. " +
              "Your own session will stay active. Continue?"
            : confirmAction?.type === "revokeUser"
              ? `Are you sure you want to revoke all sessions for ${confirmAction.userName}?`
              : confirmAction?.type === "bulkRevoke"
                ? `Are you sure you want to revoke ${confirmAction.ids?.size ?? 0} selected session${
                    (confirmAction.ids?.size ?? 0) === 1 ? "" : "s"
                  }? Affected users will be logged out.`
                : `Are you sure you want to revoke this session for ${confirmAction?.userName}?`
        }
        confirmLabel="Revoke"
        variant="danger"
      />
    </div>
  );
}
