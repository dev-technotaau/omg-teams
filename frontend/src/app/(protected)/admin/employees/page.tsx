"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { qk } from "@/lib/query-keys";
import {
  Users,
  Eye,
  Copy,
  UserX,
  RotateCcw,
  Smartphone,
  MoreVertical,
  Wifi,
  TrendingUp,
  Clock,
  Mail,
} from "lucide-react";
import { toast } from "sonner";
import {
  suspendUser,
  reactivateUser,
  resetDevice,
  assignManager as assignManagerApi,
  removeManager as removeManagerApi,
} from "@/services/user.service";
import { exportToXLSX } from "@/utils/export-table";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { listUsers } from "@/services/user.service";
import {
  PageHeader,
  SearchInput,
  DataTable,
  Badge,
  Avatar,
  Select,
  IconButton,
  Tooltip,
  DropdownMenu,
  ConfirmDialog,
  Card,
  FilterPresetsBar,
  Modal,
  Button,
  FormField,
} from "@/components/ui";
import { Link2 as LinkIcon, Link2Off } from "lucide-react";
import type { Column, ViewType, RowDensity } from "@/components/ui";
import { api } from "@/lib/api";
import { ROLE_FILTER_OPTIONS } from "@/constants/roles";
import { USER_STATUS_BADGE, USER_STATUS_FILTER_OPTIONS } from "@/constants/statuses";
import { snakeToTitle, pluralize } from "@/utils/format";
import { DEFAULT_LARGE_PAGE_SIZE } from "@/constants/pagination";
import { useDebounce } from "@/hooks";
import { useFilterPresets } from "@/hooks/use-filter-presets";
import { useTableFilters } from "@/store/table-filters";
import type { Employee } from "@/types/user";
import { usePresence, getPresenceDotClass } from "@/hooks/use-presence";
import { formatLastActive } from "@/hooks/use-firebase-presence";

const KYC_FILTER_OPTIONS = [
  { value: "", label: "All KYC" },
  { value: "complete", label: "Complete" },
  { value: "incomplete", label: "Incomplete" },
  { value: "pending", label: "Pending Review" },
  { value: "not_started", label: "Not Started" },
];

const TABLE_ID = "admin-employees";

export default function EmployeesPage() {
  const router = useRouter();
  const tableStore = useTableFilters();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [roleFilter, setRoleFilter] = useState(tableStore.getFilter(TABLE_ID, "role"));
  const [statusFilter, setStatusFilter] = useState(
    tableStore.getFilter(TABLE_ID, "status", "ACTIVE"),
  );
  const [managerFilter, setManagerFilter] = useState(tableStore.getFilter(TABLE_ID, "managerId"));
  const [kycFilter, setKycFilter] = useState(tableStore.getFilter(TABLE_ID, "kycStatus"));
  const [sortKey, setSortKey] = useState("");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [rmOptions, setRmOptions] = useState<{ value: string; label: string }[]>([
    { value: "", label: "All RMs" },
  ]);
  const [page, setPage] = useState(tableStore.getPage(TABLE_ID));
  const [viewType, setViewType] = useState<ViewType>("table");
  const { presets, activePresetId, savePreset, applyPreset, deletePreset, clearActive } =
    useFilterPresets("admin-employees");
  const [density, setDensity] = useState<RowDensity>("default");
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set());
  const [confirmAction, setConfirmAction] = useState<{
    type: string;
    userId: string;
    userName: string;
  } | null>(null);

  // §Godview — row-level assign/remove manager/recruiter modal
  type AssignmentMode =
    | "assign-manager"
    | "remove-manager"
    | "assign-recruiter"
    | "remove-recruiter";
  const [assignment, setAssignment] = useState<{
    mode: AssignmentMode;
    employee: Employee;
  } | null>(null);
  const [assignmentOptions, setAssignmentOptions] = useState<
    Array<{ id: string; firstName: string; lastName: string; employeeId: string | null }>
  >([]);
  const [assignmentLoading, setAssignmentLoading] = useState(false);
  const [assignmentSelected, setAssignmentSelected] = useState("");
  const [assignmentSaving, setAssignmentSaving] = useState(false);

  // Server state — paginated, filtered employee list. Filters become part
  // of the query key so each filter combo caches independently and switching
  // between them shows cached data instantly.
  const employeesQuery = useQuery({
    queryKey: qk.employees.list({
      page,
      search: debouncedSearch,
      role: roleFilter,
      status: statusFilter,
      managerId: managerFilter,
      kycStatus: kycFilter,
      sortKey,
      sortDir,
    }),
    queryFn: () => {
      const params: Record<string, string> = {
        page: String(page),
        limit: String(DEFAULT_LARGE_PAGE_SIZE),
      };
      if (debouncedSearch) params["search"] = debouncedSearch;
      if (roleFilter) params["role"] = roleFilter;
      if (statusFilter) params["status"] = statusFilter;
      if (managerFilter) params["managerId"] = managerFilter;
      if (kycFilter) params["kycStatus"] = kycFilter;
      if (sortKey) {
        params["sortBy"] = sortKey;
        params["sortDir"] = sortDir;
      }
      return listUsers(params);
    },
    placeholderData: keepPreviousData,
  });
  const data = employeesQuery.data ?? null;
  const isLoading = employeesQuery.isLoading;

  const fetchData = useCallback(
    () => qc.invalidateQueries({ queryKey: qk.employees.lists() }),
    [qc],
  );

  const openAssignment = async (mode: AssignmentMode, emp: Employee) => {
    setAssignment({ mode, employee: emp });
    setAssignmentSelected("");
    setAssignmentLoading(true);
    try {
      if (mode === "assign-manager") {
        const res = await api.get<{
          data: Array<{
            id: string;
            firstName: string;
            lastName: string;
            employeeId: string | null;
          }>;
        }>("/users?role=REPORTING_MANAGER&status=ACTIVE&limit=500");
        const assigned = new Set(emp.assignedManagers ?? []);
        // assignedManagers from list endpoint is an array of "First Last" strings; we can't
        // reliably diff by ID here, so show all active RMs and rely on backend uniqueness.
        setAssignmentOptions(
          (res.data.data ?? []).filter(
            (u) => !assigned.has(`${u.firstName} ${u.lastName}`),
          ),
        );
      } else if (mode === "assign-recruiter") {
        const res = await api.get<{
          data: Array<{
            id: string;
            firstName: string;
            lastName: string;
            employeeId: string | null;
          }>;
        }>("/users?role=RECRUITER&status=ACTIVE&limit=500");
        setAssignmentOptions(res.data.data ?? []);
      } else {
        // remove-* — need to fetch the current assignments from the detail endpoint
        // because the list row only has string names.
        const detail = await api.get<{
          user: {
            managers?: Array<{
              manager: { id: string; firstName: string; lastName: string };
            }>;
            managedRecruiters?: Array<{
              recruiter: { id: string; firstName: string; lastName: string };
            }>;
          };
        }>(`/users/${emp.id}`);
        if (mode === "remove-manager") {
          setAssignmentOptions(
            (detail.data.user.managers ?? []).map((m) => ({
              id: m.manager.id,
              firstName: m.manager.firstName,
              lastName: m.manager.lastName,
              employeeId: null,
            })),
          );
        } else {
          setAssignmentOptions(
            (detail.data.user.managedRecruiters ?? []).map((r) => ({
              id: r.recruiter.id,
              firstName: r.recruiter.firstName,
              lastName: r.recruiter.lastName,
              employeeId: null,
            })),
          );
        }
      }
    } catch {
      toast.error("Failed to load options");
    } finally {
      setAssignmentLoading(false);
    }
  };

  const submitAssignment = async () => {
    if (!assignment || !assignmentSelected) return;
    setAssignmentSaving(true);
    try {
      const { mode, employee: emp } = assignment;
      if (mode === "assign-manager") {
        await assignManagerApi(emp.id, assignmentSelected);
        toast.success("Manager assigned");
      } else if (mode === "remove-manager") {
        await removeManagerApi(emp.id, assignmentSelected);
        toast.success("Manager removed");
      } else if (mode === "assign-recruiter") {
        await assignManagerApi(assignmentSelected, emp.id);
        toast.success("Recruiter assigned");
      } else {
        await removeManagerApi(assignmentSelected, emp.id);
        toast.success("Recruiter removed");
      }
      setAssignment(null);
      void fetchData();
    } catch {
      toast.error("Failed to update assignment");
    } finally {
      setAssignmentSaving(false);
    }
  };

  // §23.15 — Presence tracking for all visible employees
  const employeeIds = useMemo(() => (data?.data ?? []).map((e) => e.id), [data?.data]);
  const presenceMap = usePresence(employeeIds);

  // §6.4 — Fetch list of Reporting Managers for filter dropdown
  const rmQuery = useQuery({
    queryKey: qk.users.list({ role: "REPORTING_MANAGER", status: "ACTIVE", limit: 200 }),
    queryFn: async () => {
      const res = await api.get<{
        data: Array<{ id: string; firstName: string; lastName: string }>;
      }>("/users?role=REPORTING_MANAGER&status=ACTIVE&limit=200");
      return res.data.data ?? [];
    },
    staleTime: 5 * 60 * 1000,
  });
  useEffect(() => {
    if (rmQuery.data) {
      setRmOptions([
        { value: "", label: "All RMs" },
        ...rmQuery.data.map((r) => ({ value: r.id, label: `${r.firstName} ${r.lastName}` })),
      ]);
    }
  }, [rmQuery.data]);

  const handleConfirmAction = async () => {
    if (!confirmAction) return;
    try {
      switch (confirmAction.type) {
        case "suspend":
          await suspendUser(confirmAction.userId);
          toast.success(`${confirmAction.userName} suspended`);
          break;
        case "reactivate":
          await reactivateUser(confirmAction.userId);
          toast.success(`${confirmAction.userName} reactivated`);
          break;
        case "resetDevice":
          await resetDevice(confirmAction.userId);
          toast.success(`Device reset for ${confirmAction.userName}`);
          break;
      }
      void fetchData();
    } catch {
      toast.error("Action failed");
    }
    setConfirmAction(null);
  };

  const handleSort = useCallback(
    (key: string | null, dir: "asc" | "desc" | null) => {
      setSortKey(key ?? "");
      setSortDir(dir ?? "asc");
      setPage(1);
    },
    [],
  );

  const handleBulkSuspend = useCallback(
    async (ids: Set<string>) => {
      try {
        for (const id of ids) await suspendUser(id);
        toast.success(`${ids.size} employee(s) suspended`);
        setSelectedIds(new Set());
        void fetchData();
      } catch {
        toast.error("Bulk suspend failed");
      }
    },
    [fetchData],
  );

  const handleBulkReactivate = useCallback(
    async (ids: Set<string>) => {
      try {
        for (const id of ids) await reactivateUser(id);
        toast.success(`${ids.size} employee(s) reactivated`);
        setSelectedIds(new Set());
        void fetchData();
      } catch {
        toast.error("Bulk reactivate failed");
      }
    },
    [fetchData],
  );

  const handleBulkResetDevice = useCallback(
    async (ids: Set<string>) => {
      try {
        for (const id of ids) await resetDevice(id);
        toast.success(`${ids.size} device(s) reset`);
        setSelectedIds(new Set());
        void fetchData();
      } catch {
        toast.error("Bulk device reset failed");
      }
    },
    [fetchData],
  );

  // ── Summary stats ──
  const stats = useMemo(() => {
    const emps = (data?.data ?? []) as Employee[];
    const total = data?.pagination?.total ?? emps.length;
    const online = emps.filter((e) => presenceMap[e.id]?.status === "online").length;
    const completionRates = emps.map((e) => e.completionRate).filter((v): v is number => v != null);
    const avgCompletion =
      completionRates.length > 0
        ? Math.round(completionRates.reduce((a, b) => a + b, 0) / completionRates.length)
        : 0;
    const attendanceRates = emps.map((e) => e.attendanceRate).filter((v): v is number => v != null);
    const avgAttendance =
      attendanceRates.length > 0
        ? Math.round(attendanceRates.reduce((a, b) => a + b, 0) / attendanceRates.length)
        : 0;
    return { total, online, avgCompletion, avgAttendance };
  }, [data, presenceMap]);

  // ── Card renderer for card view ──
  const cardRenderer = useCallback(
    (emp: Employee) => {
      const presence = presenceMap[emp.id];
      const status = presence?.status ?? "offline";
      return (
        <Card
          padding="sm"
          className="cursor-pointer transition-shadow hover:shadow-md"
          onClick={() => router.push(`/admin/employees/${emp.id}`)}
        >
          <div className="space-y-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="relative">
                  <Avatar name={`${emp.firstName} ${emp.lastName}`} size="md" />
                  <span
                    className={`absolute right-0 bottom-0 h-2.5 w-2.5 rounded-full border-2 border-white ${getPresenceDotClass(status)}`}
                  />
                </div>
                <div>
                  <p className="text-text-primary font-medium">
                    {emp.firstName} {emp.lastName}
                  </p>
                  <span className="text-text-secondary font-mono text-xs">
                    {emp.employeeId ?? "\u2014"}
                  </span>
                </div>
              </div>
              <Badge variant={USER_STATUS_BADGE[emp.status] ?? "default"} dot>
                {emp.status}
              </Badge>
            </div>

            <div className="text-text-muted space-y-1 text-xs">
              <div className="flex items-center gap-1.5 truncate">
                <Mail size={11} />
                {emp.email}
              </div>
              {emp.assignedManagers && emp.assignedManagers.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <Users size={11} />
                  <span className="truncate">RM: {emp.assignedManagers.join(", ")}</span>
                </div>
              )}
            </div>

            <div className="border-border-default grid grid-cols-3 gap-2 border-t pt-2 text-center text-xs">
              <div>
                <p className="text-text-muted">Candidates</p>
                <p className="text-text-primary font-semibold">
                  {emp._count?.candidateReports ?? emp.candidateCount ?? "\u2014"}
                </p>
              </div>
              <div>
                <p className="text-text-muted">Completion</p>
                <p className="text-text-primary font-semibold">
                  {emp.completionRate != null ? `${emp.completionRate}%` : "\u2014"}
                </p>
              </div>
              <div>
                <p className="text-text-muted">Attendance</p>
                <p className="text-text-primary font-semibold">
                  {emp.attendanceRate != null ? `${emp.attendanceRate}%` : "\u2014"}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs">
              <Badge variant="default" size="sm">
                {snakeToTitle(emp.role)}
              </Badge>
              <Badge variant={emp.deviceId ? "success" : "outline"} size="sm">
                {emp.deviceId ? "Bound" : "Unbound"}
              </Badge>
            </div>
          </div>
        </Card>
      );
    },
    [presenceMap, router],
  );

  const columns: Column<Employee>[] = [
    {
      key: "name",
      header: "Employee",
      sortable: true,
      cell: (emp) => {
        const presence = presenceMap[emp.id];
        const dotClass = getPresenceDotClass(presence?.status ?? "offline");
        return (
          <div className="flex items-center gap-3">
            <div className="relative">
              <Avatar name={`${emp.firstName} ${emp.lastName}`} size="sm" />
              <span
                className={`absolute right-0 bottom-0 h-2.5 w-2.5 rounded-full border-2 border-white ${dotClass}`}
              />
            </div>
            <div>
              <p className="text-text-primary font-medium">
                {emp.firstName} {emp.lastName}
              </p>
              <p className="text-text-muted text-xs">{emp.email}</p>
            </div>
          </div>
        );
      },
    },
    // §23.15 — Live Status + Last Active column
    {
      key: "liveStatus",
      header: "Live Status",
      cell: (emp) => {
        const presence = presenceMap[emp.id];
        const status = presence?.status ?? "offline";
        const lastActive = presence?.lastActiveAt;
        return (
          <div>
            <Badge
              variant={status === "online" ? "success" : status === "idle" ? "warning" : "default"}
              size="sm"
              dot
            >
              {status === "online" ? "Online" : status === "idle" ? "Idle" : "Offline"}
            </Badge>
            {status !== "online" && lastActive && (
              <p className="text-text-muted mt-0.5 text-[10px]">{formatLastActive(lastActive)}</p>
            )}
          </div>
        );
      },
    },
    {
      key: "employeeId",
      header: "Employee ID",
      sortable: true,
      cell: (emp) => (
        <div className="flex items-center gap-1">
          <span className="text-text-secondary font-mono text-sm">
            {emp.employeeId ?? "\u2014"}
          </span>
          {emp.employeeId && (
            <Tooltip content="Copy Employee ID">
              <IconButton
                icon={Copy}
                aria-label="Copy Employee ID"
                variant="ghost"
                size="xs"
                onClick={(e) => {
                  e.stopPropagation();
                  void navigator.clipboard.writeText(emp.employeeId!);
                  toast.success("Employee ID copied");
                }}
              />
            </Tooltip>
          )}
        </div>
      ),
    },
    {
      key: "role",
      header: "Role",
      sortable: true,
      cell: (emp) => <Badge variant="default">{snakeToTitle(emp.role)}</Badge>,
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      cell: (emp) => (
        <Badge variant={USER_STATUS_BADGE[emp.status] ?? "default"} dot>
          {emp.status}
        </Badge>
      ),
    },
    {
      key: "assignedManagers",
      header: "Assigned RM(s)",
      cell: (emp) => {
        const rms = emp.assignedManagers;
        if (!rms || rms.length === 0)
          return <span className="text-text-muted text-xs">{"\u2014"}</span>;
        return <span className="text-text-primary text-xs">{rms.join(", ")}</span>;
      },
    },
    {
      key: "candidates",
      header: "Candidates",
      cell: (emp) => (
        <span className="text-text-primary text-sm">
          {emp._count?.candidateReports ?? emp.candidateCount ?? "\u2014"}
        </span>
      ),
    },
    {
      key: "completionRate",
      header: "Completion %",
      cell: (emp) => {
        const rate = emp.completionRate;
        if (rate == null) return "\u2014";
        return (
          <div className="flex items-center gap-2">
            <div className="bg-bg-muted h-1.5 w-16 overflow-hidden rounded-full">
              <div className="bg-primary-500 h-full rounded-full" style={{ width: `${rate}%` }} />
            </div>
            <span className="text-xs">{rate}%</span>
          </div>
        );
      },
    },
    {
      key: "attendanceRate",
      header: "Attendance %",
      cell: (emp) => {
        if (emp.attendanceRate == null)
          return <span className="text-text-muted text-xs">{"\u2014"}</span>;
        return <span className="text-text-primary text-xs">{emp.attendanceRate}%</span>;
      },
    },
    {
      key: "lateCount",
      header: "Late",
      defaultHidden: true,
      cell: (emp) => <span className="text-text-primary text-xs">{emp.lateCount ?? "\u2014"}</span>,
    },
    {
      key: "leaveBalance",
      header: "Leave Bal.",
      defaultHidden: true,
      cell: (emp) => (
        <span className="text-text-primary text-xs">
          {emp.leaveBalance != null ? `${emp.leaveBalance}d` : "\u2014"}
        </span>
      ),
    },
    {
      key: "targetAchievement",
      header: "Target %",
      defaultHidden: true,
      cell: (emp) => {
        if (emp.targetAchievement == null)
          return <span className="text-text-muted text-xs">{"\u2014"}</span>;
        return <span className="text-text-primary text-xs">{emp.targetAchievement}%</span>;
      },
    },
    {
      key: "device",
      header: "Device",
      cell: (emp) => (
        <Badge variant={emp.deviceId ? "success" : "default"} size="sm">
          {emp.deviceId ? "Bound" : "Unbound"}
        </Badge>
      ),
    },
    {
      key: "lastActive",
      header: "Last Active",
      sortable: true,
      defaultHidden: true,
      cell: (emp) => {
        if (!emp.lastActive) return <span className="text-text-muted text-xs">{"\u2014"}</span>;
        const date = new Date(emp.lastActive);
        const diffMs = Date.now() - date.getTime();
        const diffHrs = Math.floor(diffMs / 3600000);
        if (diffHrs < 1) return <span className="text-success-500 text-xs">Online now</span>;
        return <span className="text-text-muted text-xs">{diffHrs}h ago</span>;
      },
    },
    {
      key: "kycStatus",
      header: "KYC",
      cell: (emp) => {
        const status = emp.kycStatus;
        if (!status) return <span className="text-text-muted text-xs">{"\u2014"}</span>;
        const variant =
          status === "Complete" ? "success" : status === "Not Started" ? "default" : "warning";
        return (
          <Badge variant={variant} size="sm">
            {status}
          </Badge>
        );
      },
    },
    {
      key: "actions",
      header: "Actions",
      width: "80px",
      cell: (emp) => {
        const name = `${emp.firstName} ${emp.lastName}`;
        const items = [
          {
            label: "View Profile",
            icon: Eye,
            onClick: () => router.push(`/admin/employees/${emp.id}`),
          },
        ];

        if (emp.status === "ACTIVE") {
          items.push({
            label: "Suspend",
            icon: UserX,
            onClick: () => setConfirmAction({ type: "suspend", userId: emp.id, userName: name }),
          });
        }
        if (emp.status === "SUSPENDED") {
          items.push({
            label: "Reactivate",
            icon: RotateCcw,
            onClick: () => setConfirmAction({ type: "reactivate", userId: emp.id, userName: name }),
          });
        }
        if (emp.deviceId) {
          items.push({
            label: "Reset Device",
            icon: Smartphone,
            onClick: () =>
              setConfirmAction({ type: "resetDevice", userId: emp.id, userName: name }),
          });
        }
        if (emp.role === "RECRUITER") {
          items.push({
            label: "Assign Reporting Manager",
            icon: LinkIcon,
            onClick: () => void openAssignment("assign-manager", emp),
          });
          items.push({
            label: "Remove Reporting Manager",
            icon: Link2Off,
            onClick: () => void openAssignment("remove-manager", emp),
          });
        }
        if (emp.role === "REPORTING_MANAGER") {
          items.push({
            label: "Assign Recruiter",
            icon: LinkIcon,
            onClick: () => void openAssignment("assign-recruiter", emp),
          });
          items.push({
            label: "Remove Recruiter",
            icon: Link2Off,
            onClick: () => void openAssignment("remove-recruiter", emp),
          });
        }

        return (
          <DropdownMenu
            align="right"
            trigger={
              <Tooltip content="Actions">
                <IconButton
                  icon={MoreVertical}
                  aria-label="Row actions"
                  size="sm"
                  variant="ghost"
                />
              </Tooltip>
            }
            groups={[{ items }]}
          />
        );
      },
    },
  ];

  const detailRenderer = useCallback(
    (emp: Employee) => (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Avatar name={`${emp.firstName} ${emp.lastName}`} size="lg" />
          <div>
            <p className="text-text-primary text-lg font-semibold">
              {emp.firstName} {emp.lastName}
            </p>
            <p className="text-text-muted text-sm">
              {emp.employeeId} &middot; {emp.email}
            </p>
          </div>
        </div>
        <div className="border-border-default divide-border-default divide-y rounded-lg border">
          {[
            ["Role", snakeToTitle(emp.role)],
            ["Status", emp.status],
            ["Candidates", emp._count?.candidateReports ?? emp.candidateCount ?? "\u2014"],
            ["Completion", emp.completionRate != null ? `${emp.completionRate}%` : "\u2014"],
            ["Attendance", emp.attendanceRate != null ? `${emp.attendanceRate}%` : "\u2014"],
            ["Late Count", emp.lateCount ?? "\u2014"],
            ["Leave Balance", emp.leaveBalance != null ? `${emp.leaveBalance}d` : "\u2014"],
            ["Target", emp.targetAchievement != null ? `${emp.targetAchievement}%` : "\u2014"],
            ["KYC", emp.kycStatus ?? "\u2014"],
            ["Device", emp.deviceId ? "Bound" : "Unbound"],
            ["RMs", emp.assignedManagers?.join(", ") || "\u2014"],
          ].map(([label, value]) => (
            <div key={String(label)} className="flex justify-between px-4 py-2.5 text-sm">
              <span className="text-text-muted">{label}</span>
              <span className="text-text-primary font-medium">{String(value)}</span>
            </div>
          ))}
        </div>
        <Link
          href={`/admin/employees/${emp.id}`}
          className="bg-primary-500 hover:bg-primary-600 block rounded-md px-4 py-2 text-center text-sm font-medium text-white"
        >
          View Full Profile
        </Link>
      </div>
    ),
    [],
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Employees"
        description={pluralize(stats.total, "employee")}
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
              <Wifi size={18} className="text-success-600" />
            </div>
            <div>
              <p className="text-text-muted text-xs">Online Now</p>
              <p className="text-success-600 text-xl font-bold">{stats.online}</p>
            </div>
          </div>
        </Card>
        <Card padding="sm">
          <div className="flex items-center gap-3">
            <div className="bg-info-100 flex h-10 w-10 items-center justify-center rounded-lg">
              <TrendingUp size={18} className="text-info-600" />
            </div>
            <div>
              <p className="text-text-muted text-xs">Avg Completion</p>
              <p className="text-info-600 text-xl font-bold">{stats.avgCompletion}%</p>
            </div>
          </div>
        </Card>
        <Card padding="sm">
          <div className="flex items-center gap-3">
            <div className="bg-warning-100 flex h-10 w-10 items-center justify-center rounded-lg">
              <Clock size={18} className="text-warning-600" />
            </div>
            <div>
              <p className="text-text-muted text-xs">Avg Attendance</p>
              <p className="text-warning-600 text-xl font-bold">{stats.avgAttendance}%</p>
            </div>
          </div>
        </Card>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <SearchInput
          value={search}
          onChange={(val) => {
            setSearch(val);
            setPage(1);
          }}
          onSearch={() => void fetchData()}
          placeholder="Search by name, email, Employee ID..."
          historyKey="employees"
          suggestions
          className="max-w-sm flex-1"
        />
        <Select
          value={roleFilter}
          onChange={(e) => {
            setRoleFilter(e.target.value);
            tableStore.setFilter(TABLE_ID, "role", e.target.value);
            setPage(1);
          }}
          options={ROLE_FILTER_OPTIONS}
        />
        <Select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            tableStore.setFilter(TABLE_ID, "status", e.target.value);
            setPage(1);
          }}
          options={USER_STATUS_FILTER_OPTIONS}
        />
        <Select
          value={managerFilter}
          onChange={(e) => {
            setManagerFilter(e.target.value);
            tableStore.setFilter(TABLE_ID, "managerId", e.target.value);
            setPage(1);
          }}
          options={rmOptions}
        />
        <Select
          value={kycFilter}
          onChange={(e) => {
            setKycFilter(e.target.value);
            tableStore.setFilter(TABLE_ID, "kycStatus", e.target.value);
            setPage(1);
          }}
          options={KYC_FILTER_OPTIONS}
        />
      </div>

      {presets.length > 0 && (
        <FilterPresetsBar
          presets={presets}
          activePresetId={activePresetId}
          onApply={(id) => {
            const filters = applyPreset(id);
            if (filters) {
              if (filters.role) setRoleFilter(filters.role);
              if (filters.status) setStatusFilter(filters.status);
              if (filters.managerId) setManagerFilter(filters.managerId);
              if (filters.kycStatus) setKycFilter(filters.kycStatus);
            }
          }}
          onSave={(name) => {
            savePreset(name, {
              ...(roleFilter && { role: roleFilter }),
              ...(statusFilter && { status: statusFilter }),
              ...(managerFilter && { managerId: managerFilter }),
              ...(kycFilter && { kycStatus: kycFilter }),
            });
          }}
          onDelete={deletePreset}
          onClear={clearActive}
        />
      )}

      <DataTable
        columns={columns}
        data={(data?.data as Employee[]) ?? []}
        loading={isLoading}
        emptyIcon={Users}
        emptyTitle="No employees found"
        emptyDescription="Try adjusting your search or filters."
        // Sorting
        sortKey={sortKey}
        sortDir={sortDir}
        onSort={handleSort}
        // Pagination
        page={page}
        totalPages={
          data?.pagination ? Math.ceil(data.pagination.total / DEFAULT_LARGE_PAGE_SIZE) : 1
        }
        total={data?.pagination?.total ?? 0}
        pageSize={DEFAULT_LARGE_PAGE_SIZE}
        onPageChange={(p) => {
          setPage(p);
          tableStore.setPage(TABLE_ID, p);
        }}
        // Selection + Bulk
        selectable
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        getRowId={(e) => e.id}
        bulkActions={[
          {
            label: "Suspend",
            icon: UserX,
            onClick: (ids) => void handleBulkSuspend(ids),
            variant: "danger",
          },
          {
            label: "Reactivate",
            icon: RotateCcw,
            onClick: (ids) => void handleBulkReactivate(ids),
          },
          {
            label: "Reset Device",
            icon: Smartphone,
            onClick: (ids) => void handleBulkResetDevice(ids),
          },
        ]}
        stickyHeader
        enableColumnVisibility
        density={density}
        onDensityChange={setDensity}
        pinnedIds={pinnedIds}
        onPinChange={setPinnedIds}
        detailRenderer={detailRenderer}
        detailTitle={() => "Quick View"}
        enableKeyboardNav
        // View toggle
        viewType={viewType}
        onViewTypeChange={setViewType}
        cardRenderer={cardRenderer}
        onExport={() => {
          const rows = (data?.data as Employee[]) ?? [];
          exportToXLSX(
            rows,
            [
              { header: "Employee ID", accessor: (e) => e.employeeId },
              { header: "First Name", accessor: (e) => e.firstName },
              { header: "Last Name", accessor: (e) => e.lastName },
              { header: "Email", accessor: (e) => e.email },
              { header: "Role", accessor: (e) => snakeToTitle(e.role) },
              { header: "Status", accessor: (e) => e.status },
              {
                header: "Candidates",
                accessor: (e) => e._count?.candidateReports ?? e.candidateCount ?? null,
              },
              { header: "Completion %", accessor: (e) => e.completionRate ?? null },
              { header: "Attendance %", accessor: (e) => e.attendanceRate ?? null },
              { header: "Late Count", accessor: (e) => e.lateCount ?? null },
              { header: "Leave Balance", accessor: (e) => e.leaveBalance ?? null },
              { header: "Target %", accessor: (e) => e.targetAchievement ?? null },
            ],
            "employees",
          );
        }}
      />

      {/* §Godview — Assign/Remove manager/recruiter modal */}
      <Modal
        open={assignment !== null}
        onClose={() => setAssignment(null)}
        title={
          assignment?.mode === "assign-manager"
            ? `Assign Reporting Manager to ${assignment.employee.firstName} ${assignment.employee.lastName}`
            : assignment?.mode === "remove-manager"
              ? `Remove Reporting Manager from ${assignment.employee.firstName} ${assignment.employee.lastName}`
              : assignment?.mode === "assign-recruiter"
                ? `Assign Recruiter to ${assignment.employee.firstName} ${assignment.employee.lastName}`
                : assignment?.mode === "remove-recruiter"
                  ? `Remove Recruiter from ${assignment.employee.firstName} ${assignment.employee.lastName}`
                  : ""
        }
        size="sm"
      >
        <div className="space-y-3">
          {assignmentLoading ? (
            <p className="text-text-muted text-sm">Loading options…</p>
          ) : assignmentOptions.length === 0 ? (
            <p className="text-text-muted text-sm">
              {assignment?.mode.startsWith("remove")
                ? "No current assignments to remove."
                : "No eligible users available."}
            </p>
          ) : (
            <FormField
              label={
                assignment?.mode.includes("manager") ? "Reporting Manager" : "Recruiter"
              }
              htmlFor="row-assignment-select"
              required
            >
              <Select
                id="row-assignment-select"
                value={assignmentSelected}
                onChange={(e) => setAssignmentSelected(e.target.value)}
                options={[
                  { value: "", label: "— Select —" },
                  ...assignmentOptions.map((u) => ({
                    value: u.id,
                    label: `${u.firstName} ${u.lastName}${u.employeeId ? ` (${u.employeeId})` : ""}`,
                  })),
                ]}
              />
            </FormField>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setAssignment(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => void submitAssignment()}
              disabled={!assignmentSelected || assignmentLoading || assignmentSaving}
            >
              {assignmentSaving ? "Saving…" : "Confirm"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* §6.4 — Confirm action dialog */}
      <ConfirmDialog
        open={!!confirmAction}
        onClose={() => setConfirmAction(null)}
        onConfirm={handleConfirmAction}
        title={
          confirmAction?.type === "suspend"
            ? "Suspend Employee"
            : confirmAction?.type === "reactivate"
              ? "Reactivate Employee"
              : "Reset Device"
        }
        description={`Are you sure you want to ${confirmAction?.type === "resetDevice" ? "reset device for" : confirmAction?.type} ${confirmAction?.userName ?? "this employee"}?`}
        confirmLabel={
          confirmAction?.type === "suspend"
            ? "Suspend"
            : confirmAction?.type === "reactivate"
              ? "Reactivate"
              : "Reset"
        }
        variant={confirmAction?.type === "suspend" ? "danger" : "default"}
      />
    </div>
  );
}
