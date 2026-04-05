"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Plus,
  UserX,
  RotateCcw,
  Smartphone,
  MoreVertical,
  Key,
  LogOut,
  RefreshCw,
  Info,
  ShieldCheck,
  Unlock,
  Users,
  CheckCircle,
  XCircle,
  Link2,
  Mail,
} from "lucide-react";
import { toast } from "sonner";
import {
  listUsers,
  createUser,
  suspendUser,
  reactivateUser,
  resetDevice,
  resetPassword,
  forceLogout,
  forceSwitchDevice,
  getUserDeviceInfo,
  reactivateWithDeviceReset,
  generateBackupCodes,
  unlockAccount,
  type PaginatedUsers,
  type DeviceInfo,
} from "@/services/user.service";
import {
  PageHeader,
  SearchInput,
  Select,
  DataTable,
  Badge,
  Avatar,
  Tooltip,
  IconButton,
  Button,
  Modal,
  FormField,
  Input,
  Card,
  ConfirmDialog,
  DropdownMenu,
  FilterPresetsBar,
} from "@/components/ui";
import { AdminPasswordDialog } from "@/components/admin-password-dialog";
import { PasswordStrength } from "@/components/password-strength";
import type { Column, ViewType, RowDensity } from "@/components/ui";
import { useFilterPresets } from "@/hooks/use-filter-presets";
import { ROLE_FILTER_OPTIONS, ROLE_CREATE_OPTIONS } from "@/constants/roles";
import { USER_STATUS_BADGE } from "@/constants/statuses";
import { snakeToTitle } from "@/utils/format";
import { exportToXLSX } from "@/utils/export-table";
import { DEFAULT_PAGE_SIZE } from "@/constants/pagination";
import { createUserSchema } from "@/validators/user";

// ──────────────────────────────────────────────
//  User Management — Spec Section 6.3
//  Create, suspend, reactivate, reset password, reset device
// ──────────────────────────────────────────────

type User = PaginatedUsers["data"][number];

export default function UserManagementPage() {
  const [data, setData] = useState<PaginatedUsers | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusQuickFilter, setStatusQuickFilter] = useState("");
  const [sortKey, setSortKey] = useState("");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [viewType, setViewType] = useState<ViewType>("table");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [rmOptions, setRmOptions] = useState<{ value: string; label: string }[]>([]);
  const [createdUser, setCreatedUser] = useState<{
    employeeId: string;
    plainPassword: string;
    firstName: string;
    lastName: string;
    email: string;
    role: string;
    assignedManagers?: string[];
  } | null>(null);
  const [confirmAction, setConfirmAction] = useState<{
    type: string;
    userId: string;
    userName: string;
  } | null>(null);
  const [pwVerifyTarget, setPwVerifyTarget] = useState<{
    userId: string;
    userName: string;
  } | null>(null);
  const [deviceInfoTarget, setDeviceInfoTarget] = useState<string | null>(null);
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null);
  const [deviceInfoLoading, setDeviceInfoLoading] = useState(false);
  const [deviceFilter, setDeviceFilter] = useState("");
  const { presets, activePresetId, savePreset, applyPreset, deletePreset, clearActive } =
    useFilterPresets("admin-users");
  const [density, setDensity] = useState<RowDensity>("default");
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set());
  // §25.2 — Password strength tracking for create form
  const [createPassword, setCreatePassword] = useState("");
  // §23.16 — Backup codes modal
  const [backupCodesResult, setBackupCodesResult] = useState<{
    codes: string[];
    userName: string;
  } | null>(null);

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const params: Record<string, string> = {
        page: String(page),
        limit: String(DEFAULT_PAGE_SIZE),
      };
      if (search) params["search"] = search;
      if (roleFilter) params["role"] = roleFilter;
      if (deviceFilter) params["deviceStatus"] = deviceFilter;
      if (statusQuickFilter) params["status"] = statusQuickFilter;
      if (sortKey) {
        params["sortBy"] = sortKey;
        params["sortDir"] = sortDir;
      }
      setData(await listUsers(params));
    } finally {
      setIsLoading(false);
    }
  }, [page, search, roleFilter, deviceFilter, statusQuickFilter, sortKey, sortDir]);

  useEffect(() => {
    void fetchUsers();
  }, [fetchUsers]);

  // §6.3 — Fetch RMs for assignment dropdown during account creation
  useEffect(() => {
    void (async () => {
      try {
        const res = await listUsers({ role: "REPORTING_MANAGER", status: "ACTIVE", limit: "200" });
        setRmOptions(
          (res.data ?? []).map((u) => ({
            value: u.id,
            label: `${u.firstName} ${u.lastName}`,
          })),
        );
      } catch {
        /* non-critical */
      }
    })();
  }, []);

  const handleCreateUser = async (formData: FormData) => {
    try {
      const raw = {
        email: formData.get("email") as string,
        password: formData.get("password") as string,
        firstName: formData.get("firstName") as string,
        lastName: formData.get("lastName") as string,
        role: formData.get("role") as "RECRUITER" | "REPORTING_MANAGER",
      };
      const parsed = createUserSchema.safeParse(raw);
      if (!parsed.success) {
        toast.error(parsed.error.issues[0]?.message ?? "Validation failed");
        return;
      }
      // §6.3 — Collect selected RM IDs from multi-select
      const managerSelect = formData.getAll("managerIds") as string[];
      const managerIds = managerSelect.filter(Boolean);
      const result = await createUser({
        ...parsed.data,
        ...(managerIds.length > 0 && { managerIds }),
      });
      setCreatedUser(result);
      setShowCreateModal(false);
      toast.success("Account created");
      void fetchUsers();
    } catch {
      toast.error("Failed to create account");
    }
  };

  const handleConfirmAction = async () => {
    if (!confirmAction) return;
    try {
      switch (confirmAction.type) {
        case "suspend":
          await suspendUser(confirmAction.userId);
          toast.success("User suspended");
          break;
        case "reactivate":
          await reactivateUser(confirmAction.userId);
          toast.success("User reactivated");
          break;
        case "resetDevice":
          await resetDevice(confirmAction.userId);
          toast.success("Device reset");
          break;
        case "forceLogout":
          await forceLogout(confirmAction.userId);
          toast.success("User forcefully logged out");
          break;
        case "forceSwitchDevice":
          await forceSwitchDevice(confirmAction.userId);
          toast.success("Device reset and user logged out");
          break;
        case "reactivateWithReset":
          await reactivateWithDeviceReset(confirmAction.userId);
          toast.success("User reactivated with device reset");
          break;
        case "unlockAccount":
          await unlockAccount(confirmAction.userId);
          toast.success("Account unlocked");
          break;
      }
      void fetchUsers();
    } catch {
      toast.error("Action failed");
    }
    setConfirmAction(null);
  };

  // §23.16 — Generate and display backup codes
  const handleGenerateBackupCodes = async (userId: string, userName: string) => {
    try {
      const result = await generateBackupCodes(userId);
      setBackupCodesResult({ codes: result.codes, userName });
    } catch {
      toast.error("Failed to generate backup codes");
    }
  };

  // §22.9 — Open device info modal for a user
  const openDeviceInfo = async (userId: string) => {
    setDeviceInfoTarget(userId);
    setDeviceInfoLoading(true);
    try {
      const info = await getUserDeviceInfo(userId);
      setDeviceInfo(info);
    } catch {
      toast.error("Failed to load device info");
      setDeviceInfoTarget(null);
    } finally {
      setDeviceInfoLoading(false);
    }
  };

  const handleSort = useCallback(
    (key: string) => {
      setSortDir((prev) => (sortKey === key && prev === "asc" ? "desc" : "asc"));
      setSortKey(key);
      setPage(1);
    },
    [sortKey],
  );

  const handleExport = useCallback(() => {
    if (!data?.data) return;
    exportToXLSX(
      data.data,
      [
        { header: "Employee ID", accessor: (u) => u.employeeId },
        { header: "First Name", accessor: (u) => u.firstName },
        { header: "Last Name", accessor: (u) => u.lastName },
        { header: "Email", accessor: (u) => u.email },
        { header: "Role", accessor: (u) => snakeToTitle(u.role) },
        { header: "Status", accessor: (u) => u.status },
        { header: "Device", accessor: (u) => (u.deviceId ? "Bound" : "Unbound") },
        { header: "Created", accessor: (u) => new Date(u.createdAt).toLocaleDateString("en-IN") },
      ],
      "users-export",
    );
  }, [data]);

  // ── Summary stats ──
  const stats = useMemo(() => {
    const users = data?.data ?? [];
    const total = data?.pagination?.total ?? users.length;
    const active = users.filter((u) => u.status === "ACTIVE").length;
    const suspended = users.filter((u) => u.status === "SUSPENDED").length;
    const deviceBound = users.filter((u) => u.deviceId).length;
    return { total, active, suspended, deviceBound };
  }, [data]);

  // ── Card renderer for card view ──
  const cardRenderer = useCallback(
    (user: User) => (
      <Card padding="sm" className="transition-shadow hover:shadow-md">
        <div className="space-y-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2.5">
              <Avatar name={`${user.firstName} ${user.lastName}`} size="md" />
              <div>
                <p className="text-text-primary font-medium">
                  {user.firstName} {user.lastName}
                </p>
                <span className="text-text-secondary font-mono text-xs">
                  {user.employeeId ?? "\u2014"}
                </span>
              </div>
            </div>
            <Badge variant={USER_STATUS_BADGE[user.status] ?? "default"} dot>
              {user.status}
            </Badge>
          </div>

          <div className="text-text-muted space-y-1 text-xs">
            <div className="flex items-center gap-1.5">
              <Mail size={11} />
              <span className="truncate">{user.email}</span>
            </div>
          </div>

          <div className="border-border-default flex items-center justify-between border-t pt-2">
            <Badge variant="default" size="sm">
              {snakeToTitle(user.role)}
            </Badge>
            <Badge variant={user.deviceId ? "success" : "outline"} size="sm">
              {user.deviceId ? "Device Bound" : "Unbound"}
            </Badge>
          </div>
        </div>
      </Card>
    ),
    [],
  );

  const handleBulkSuspend = useCallback(
    async (ids: Set<string>) => {
      try {
        for (const id of ids) await suspendUser(id);
        toast.success(`${ids.size} user(s) suspended`);
        setSelectedIds(new Set());
        void fetchUsers();
      } catch {
        toast.error("Bulk suspend failed");
      }
    },
    [fetchUsers],
  );

  const handleBulkReactivate = useCallback(
    async (ids: Set<string>) => {
      try {
        for (const id of ids) await reactivateUser(id);
        toast.success(`${ids.size} user(s) reactivated`);
        setSelectedIds(new Set());
        void fetchUsers();
      } catch {
        toast.error("Bulk reactivate failed");
      }
    },
    [fetchUsers],
  );

  const handleBulkResetDevice = useCallback(
    async (ids: Set<string>) => {
      try {
        for (const id of ids) await resetDevice(id);
        toast.success(`${ids.size} device(s) reset`);
        setSelectedIds(new Set());
        void fetchUsers();
      } catch {
        toast.error("Bulk device reset failed");
      }
    },
    [fetchUsers],
  );

  const columns = useMemo<Column<User>[]>(
    () => [
      {
        key: "employee",
        header: "Employee",
        cell: (user) => (
          <div className="flex items-center gap-3">
            <Avatar name={`${user.firstName} ${user.lastName}`} size="sm" />
            <div>
              <p className="text-text-primary font-medium">
                {user.firstName} {user.lastName}
              </p>
              <p className="text-text-muted text-xs">{user.email}</p>
            </div>
          </div>
        ),
      },
      {
        key: "employeeId",
        header: "Employee ID",
        sortable: true,
        cell: (user) => (
          <span className="text-text-secondary font-mono text-sm">
            {user.employeeId ?? "\u2014"}
          </span>
        ),
      },
      {
        key: "role",
        header: "Role",
        sortable: true,
        cell: (user) => <Badge variant="default">{snakeToTitle(user.role)}</Badge>,
      },
      {
        key: "status",
        header: "Status",
        sortable: true,
        cell: (user) => (
          <Badge variant={USER_STATUS_BADGE[user.status] ?? "default"} dot>
            {user.status}
          </Badge>
        ),
      },
      {
        key: "device",
        header: "Device",
        cell: (user) => (
          <Badge variant={user.deviceId ? "success" : "outline"} size="sm">
            {user.deviceId ? "Bound" : "Unbound"}
          </Badge>
        ),
      },
      {
        key: "actions",
        header: "Actions",
        width: "80px",
        cell: (user) => {
          const items = [];

          if (user.status === "ACTIVE") {
            items.push({
              label: "Suspend",
              icon: UserX,
              onClick: () =>
                setConfirmAction({
                  type: "suspend",
                  userId: user.id,
                  userName: `${user.firstName} ${user.lastName}`,
                }),
            });
          }

          if (user.status === "SUSPENDED") {
            items.push({
              label: "Reactivate",
              icon: RotateCcw,
              onClick: () =>
                setConfirmAction({
                  type: "reactivate",
                  userId: user.id,
                  userName: `${user.firstName} ${user.lastName}`,
                }),
            });
            // §22.9 — Combined reactivate + reset device binding
            items.push({
              label: "Reactivate + Reset Device",
              icon: ShieldCheck,
              onClick: () =>
                setConfirmAction({
                  type: "reactivateWithReset",
                  userId: user.id,
                  userName: `${user.firstName} ${user.lastName}`,
                }),
            });
          }

          items.push({
            label: "Reset Password",
            icon: Key,
            onClick: () =>
              setPwVerifyTarget({
                userId: user.id,
                userName: `${user.firstName} ${user.lastName}`,
              }),
          });

          // §22.9 — View device info for any user (bound or not — shows history)
          items.push({
            label: "View Device Info",
            icon: Info,
            onClick: () => void openDeviceInfo(user.id),
          });

          // §23.16 — Generate backup codes
          if (user.role !== "ADMIN") {
            items.push({
              label: "Generate Backup Codes",
              icon: Key,
              onClick: () =>
                void handleGenerateBackupCodes(user.id, `${user.firstName} ${user.lastName}`),
            });
          }

          if (user.deviceId) {
            items.push({
              label: "Reset Device",
              icon: Smartphone,
              onClick: () =>
                setConfirmAction({
                  type: "resetDevice",
                  userId: user.id,
                  userName: `${user.firstName} ${user.lastName}`,
                }),
            });
            items.push({
              label: "Force Switch Device",
              icon: RefreshCw,
              onClick: () =>
                setConfirmAction({
                  type: "forceSwitchDevice",
                  userId: user.id,
                  userName: `${user.firstName} ${user.lastName}`,
                }),
            });
          }

          items.push({
            label: "Force Logout",
            icon: LogOut,
            onClick: () =>
              setConfirmAction({
                type: "forceLogout",
                userId: user.id,
                userName: `${user.firstName} ${user.lastName}`,
              }),
          });

          // §25.1 — Unlock locked-out account (admin override)
          items.push({
            label: "Unlock Account",
            icon: Unlock,
            onClick: () =>
              setConfirmAction({
                type: "unlockAccount",
                userId: user.id,
                userName: `${user.firstName} ${user.lastName}`,
              }),
          });

          if (items.length === 0) return null;

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
    ],
    [],
  );

  const detailRendererFn = useCallback(
    (user: User) => (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Avatar name={`${user.firstName} ${user.lastName}`} size="lg" />
          <div>
            <p className="text-text-primary text-lg font-semibold">
              {user.firstName} {user.lastName}
            </p>
            <p className="text-text-muted text-sm">{user.email}</p>
          </div>
        </div>
        <div className="border-border-default divide-border-default divide-y rounded-lg border">
          {[
            ["Employee ID", user.employeeId ?? "\u2014"],
            ["Role", snakeToTitle(user.role)],
            ["Status", user.status],
            ["Device", user.deviceId ? "Bound" : "Unbound"],
            ["Created", new Date(user.createdAt).toLocaleDateString("en-IN")],
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between px-4 py-2.5 text-sm">
              <span className="text-text-muted">{label}</span>
              <span className="text-text-primary font-medium">{value}</span>
            </div>
          ))}
        </div>
      </div>
    ),
    [],
  );

  const totalPages = data?.pagination ? Math.ceil(data.pagination.total / DEFAULT_PAGE_SIZE) : 1;

  return (
    <div className="space-y-4">
      <PageHeader
        title="User Management"
        actions={
          <Button leftIcon={Plus} onClick={() => setShowCreateModal(true)}>
            Create Account
          </Button>
        }
      />

      {/* ── Summary Stats Cards ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card padding="sm">
          <div className="flex items-center gap-3">
            <div className="bg-primary-100 flex h-10 w-10 items-center justify-center rounded-lg">
              <Users size={18} className="text-primary-600" />
            </div>
            <div>
              <p className="text-text-muted text-xs">Total Users</p>
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
              <p className="text-text-muted text-xs">Active</p>
              <p className="text-success-600 text-xl font-bold">{stats.active}</p>
            </div>
          </div>
        </Card>
        <Card padding="sm">
          <div className="flex items-center gap-3">
            <div className="bg-error-100 flex h-10 w-10 items-center justify-center rounded-lg">
              <XCircle size={18} className="text-error-600" />
            </div>
            <div>
              <p className="text-text-muted text-xs">Suspended</p>
              <p className="text-error-600 text-xl font-bold">{stats.suspended}</p>
            </div>
          </div>
        </Card>
        <Card padding="sm">
          <div className="flex items-center gap-3">
            <div className="bg-info-100 flex h-10 w-10 items-center justify-center rounded-lg">
              <Link2 size={18} className="text-info-600" />
            </div>
            <div>
              <p className="text-text-muted text-xs">Device Bound</p>
              <p className="text-info-600 text-xl font-bold">{stats.deviceBound}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <SearchInput
          value={search}
          onChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          placeholder="Search by name, email, Employee ID..."
          historyKey="users"
          suggestions
          className="max-w-sm flex-1"
        />
        <Select
          value={roleFilter}
          onChange={(e) => {
            setRoleFilter(e.target.value);
            setPage(1);
          }}
          options={ROLE_FILTER_OPTIONS}
          className="w-52"
        />
        {/* §22.12 — Device status filter */}
        <Select
          value={deviceFilter}
          onChange={(e) => {
            setDeviceFilter(e.target.value);
            setPage(1);
          }}
          options={[
            { value: "", label: "All Devices" },
            { value: "bound", label: "Device Bound" },
            { value: "unbound", label: "Device Unbound" },
          ]}
          className="w-44"
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
              if (filters.status) setStatusQuickFilter(filters.status);
              if (filters.device) setDeviceFilter(filters.device);
            }
          }}
          onSave={(name) => {
            savePreset(name, {
              ...(roleFilter && { role: roleFilter }),
              ...(statusQuickFilter && { status: statusQuickFilter }),
              ...(deviceFilter && { device: deviceFilter }),
            });
          }}
          onDelete={deletePreset}
          onClear={clearActive}
        />
      )}

      {/* Table */}
      <DataTable<User>
        columns={columns}
        data={data?.data ?? []}
        loading={isLoading}
        // Sorting
        sortKey={sortKey}
        sortDir={sortDir}
        onSort={handleSort}
        // Pagination
        page={page}
        totalPages={totalPages}
        total={data?.pagination?.total}
        pageSize={DEFAULT_PAGE_SIZE}
        onPageChange={setPage}
        // Selection + Bulk Actions
        selectable
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        getRowId={(u) => u.id}
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
        // Quick filters by status
        quickFilters={[
          { label: "All", value: "", active: statusQuickFilter === "" },
          { label: "Active", value: "ACTIVE", active: statusQuickFilter === "ACTIVE" },
          { label: "Suspended", value: "SUSPENDED", active: statusQuickFilter === "SUSPENDED" },
        ]}
        onQuickFilter={(val) => {
          setStatusQuickFilter(val);
          setPage(1);
        }}
        // Export
        onExport={handleExport}
        // View toggle
        viewType={viewType}
        onViewTypeChange={setViewType}
        cardRenderer={cardRenderer}
        emptyTitle="No users found"
        emptyDescription="No users match the current filters."
        stickyHeader
        enableColumnVisibility
        density={density}
        onDensityChange={setDensity}
        pinnedIds={pinnedIds}
        onPinChange={setPinnedIds}
        detailRenderer={detailRendererFn}
        detailTitle={(u) => `${u.firstName} ${u.lastName}`}
        enableKeyboardNav
      />

      {/* Create Account Modal */}
      <Modal
        open={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          setCreatePassword("");
        }}
        title="Create Employee Account"
        size="md"
      >
        <form action={handleCreateUser} className="space-y-4">
          <FormField label="First Name" htmlFor="firstName" required>
            <Input id="firstName" name="firstName" placeholder="First Name" required />
          </FormField>
          <FormField label="Last Name" htmlFor="lastName" required>
            <Input id="lastName" name="lastName" placeholder="Last Name" required />
          </FormField>
          <FormField label="Email" htmlFor="email" required>
            <Input id="email" name="email" type="email" placeholder="Email" required />
          </FormField>
          <FormField label="Password" htmlFor="password" required>
            <Input
              id="password"
              name="password"
              type="password"
              placeholder="Password"
              required
              minLength={8}
              value={createPassword}
              onChange={(e) => setCreatePassword(e.target.value)}
            />
            <PasswordStrength password={createPassword} />
          </FormField>
          <FormField label="Role" htmlFor="role" required>
            <Select id="role" name="role" options={ROLE_CREATE_OPTIONS} required />
          </FormField>
          {/* §6.3 — Assign Reporting Manager(s) during creation */}
          {rmOptions.length > 0 && (
            <FormField label="Assign Reporting Manager(s)" htmlFor="managerIds">
              <select
                id="managerIds"
                name="managerIds"
                multiple
                className="border-border-default bg-bg-input text-text-primary focus:border-border-focus focus:ring-primary-500 w-full rounded-md border px-3 py-2 text-sm focus:ring-1 focus:outline-hidden"
              >
                {rmOptions.map((rm) => (
                  <option key={rm.value} value={rm.value}>
                    {rm.label}
                  </option>
                ))}
              </select>
              <p className="text-text-muted mt-1 text-xs">
                Hold Ctrl/Cmd to select multiple. Only applies to Recruiter role.
              </p>
            </FormField>
          )}
          {/* §6.3 — Offer letter generation link */}
          <p className="text-text-secondary text-xs">
            Offer letter can be generated after creation from the{" "}
            <a href="/admin/offer-letters" className="text-text-link underline">
              Offer Letters
            </a>{" "}
            page.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setShowCreateModal(false)}>
              Cancel
            </Button>
            <Button type="submit">Create</Button>
          </div>
        </form>
      </Modal>

      {/* Success Modal — Spec Section 6.3.2 (Gaps 7, 8, 14) */}
      <Modal
        open={!!createdUser}
        onClose={() => setCreatedUser(null)}
        title="Employee Account Created Successfully &#x2705;"
        size="md"
        closeOnOverlayClick={false}
        footer={
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                if (!createdUser) return;
                const content = [
                  `Employee Credentials`,
                  `--------------------`,
                  `Name: ${createdUser.firstName} ${createdUser.lastName}`,
                  `Role: ${snakeToTitle(createdUser.role)}`,
                  `Email: ${createdUser.email}`,
                  `Employee ID: ${createdUser.employeeId}`,
                  `Password: ${createdUser.plainPassword}`,
                  createdUser.assignedManagers?.length
                    ? `Assigned RM(s): ${createdUser.assignedManagers.join(", ")}`
                    : "",
                ]
                  .filter(Boolean)
                  .join("\n");
                const blob = new Blob([content], { type: "text/plain" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `${createdUser.employeeId}-credentials.txt`;
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              Download Credentials
            </Button>
            <Button className="flex-1" onClick={() => setCreatedUser(null)}>
              Close
            </Button>
          </div>
        }
      >
        {createdUser && (
          <div className="space-y-3 text-sm">
            <p>
              <strong>Name:</strong> {createdUser.firstName} {createdUser.lastName}
            </p>
            <p>
              <strong>Role:</strong> {snakeToTitle(createdUser.role)}
            </p>
            <p>
              <strong>Email:</strong> {createdUser.email}
            </p>
            <div className="flex items-center gap-2">
              <strong>Employee ID:</strong>
              <code className="bg-bg-muted rounded-sm px-2 py-1 font-mono">
                {createdUser.employeeId}
              </code>
              <Button
                variant="ghost"
                size="xs"
                onClick={() => {
                  void navigator.clipboard.writeText(createdUser.employeeId);
                  toast.success("Employee ID copied");
                }}
              >
                Copy
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <strong>Password:</strong>
              <code className="bg-bg-muted rounded-sm px-2 py-1 font-mono">
                {createdUser.plainPassword}
              </code>
              <Button
                variant="ghost"
                size="xs"
                onClick={() => {
                  void navigator.clipboard.writeText(createdUser.plainPassword);
                  toast.success("Password copied");
                }}
              >
                Copy
              </Button>
            </div>
            {createdUser.assignedManagers && createdUser.assignedManagers.length > 0 && (
              <p>
                <strong>Assigned RM(s):</strong> {createdUser.assignedManagers.join(", ")}
              </p>
            )}
          </div>
        )}
      </Modal>

      {/* Confirm Dialog */}
      <ConfirmDialog
        open={!!confirmAction}
        onClose={() => setConfirmAction(null)}
        onConfirm={handleConfirmAction}
        title={
          confirmAction?.type === "suspend"
            ? "Suspend User"
            : confirmAction?.type === "reactivate"
              ? "Reactivate User"
              : confirmAction?.type === "reactivateWithReset"
                ? "Reactivate + Reset Device"
                : confirmAction?.type === "unlockAccount"
                  ? "Unlock Account"
                  : confirmAction?.type === "forceLogout"
                    ? "Force Logout"
                    : confirmAction?.type === "forceSwitchDevice"
                      ? "Force Switch Device"
                      : "Reset Device"
        }
        description={
          confirmAction?.type === "unlockAccount"
            ? `Unlock ${confirmAction?.userName ?? "this user"}'s account? This clears the lockout so they can attempt to log in again.`
            : confirmAction?.type === "forceLogout"
              ? `Force logout ${confirmAction?.userName ?? "this user"} from all active sessions?`
              : confirmAction?.type === "forceSwitchDevice"
                ? `Reset device binding and force logout ${confirmAction?.userName ?? "this user"}? They will need to log in again from their new device.`
                : confirmAction?.type === "reactivateWithReset"
                  ? `Reactivate ${confirmAction?.userName ?? "this user"} and reset their device binding? They will need to log in from their current device.`
                  : `Are you sure you want to ${confirmAction?.type === "resetDevice" ? "reset device for" : confirmAction?.type} ${confirmAction?.userName ?? "this user"}?`
        }
        confirmLabel={
          confirmAction?.type === "suspend"
            ? "Suspend"
            : confirmAction?.type === "reactivate"
              ? "Reactivate"
              : confirmAction?.type === "reactivateWithReset"
                ? "Reactivate + Reset"
                : confirmAction?.type === "forceLogout"
                  ? "Force Logout"
                  : confirmAction?.type === "forceSwitchDevice"
                    ? "Force Switch"
                    : "Reset"
        }
        variant={
          confirmAction?.type === "suspend" || confirmAction?.type === "forceLogout"
            ? "danger"
            : "default"
        }
      />

      {/* Admin Password Verification — Spec Section 6.3.3 */}
      <AdminPasswordDialog
        open={!!pwVerifyTarget}
        onClose={() => setPwVerifyTarget(null)}
        title="Verify Admin Password"
        onVerified={async () => {
          if (!pwVerifyTarget) return;
          try {
            const newPw = Math.random().toString(36).slice(-10);
            await resetPassword(pwVerifyTarget.userId, newPw);
            toast.success(`Password reset for ${pwVerifyTarget.userName}. New password: ${newPw}`);
          } catch {
            toast.error("Failed to reset password");
          }
          setPwVerifyTarget(null);
        }}
      />

      {/* §23.16 — Backup Codes Modal */}
      <Modal
        open={!!backupCodesResult}
        onClose={() => setBackupCodesResult(null)}
        title={`Backup Codes — ${backupCodesResult?.userName ?? ""}`}
      >
        <div className="space-y-3">
          <p className="text-text-secondary text-sm">
            These codes are shown <strong>once only</strong>. Copy or print them now and provide
            them to the employee securely. Each code can only be used once.
          </p>
          <div className="bg-bg-muted grid grid-cols-2 gap-2 rounded-lg p-4">
            {backupCodesResult?.codes.map((code, i) => (
              <code
                key={i}
                className="text-text-primary rounded bg-white px-3 py-2 text-center font-mono text-sm tracking-wider dark:bg-black/20"
              >
                {code}
              </code>
            ))}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                void navigator.clipboard.writeText(backupCodesResult?.codes.join("\n") ?? "");
                toast.success("Codes copied to clipboard");
              }}
            >
              Copy All
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const text = backupCodesResult?.codes.join("\n") ?? "";
                const blob = new Blob([text], { type: "text/plain" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `backup-codes-${backupCodesResult?.userName?.replace(/\s/g, "-")}.txt`;
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              Download
            </Button>
          </div>
        </div>
      </Modal>

      {/* §22.9 — Device Info Modal: device binding details + device history + login history */}
      <Modal
        open={!!deviceInfoTarget}
        onClose={() => {
          setDeviceInfoTarget(null);
          setDeviceInfo(null);
        }}
        title={`Device Info${deviceInfo?.userName ? ` — ${deviceInfo.userName}` : ""}`}
        size="lg"
      >
        {deviceInfoLoading ? (
          <div className="text-text-muted py-8 text-center text-sm">Loading device info...</div>
        ) : deviceInfo ? (
          <div className="max-h-[70vh] space-y-5 overflow-y-auto pr-1">
            {/* Current Device Binding */}
            <div className="border-border-default rounded-lg border p-4">
              <h4 className="text-text-primary mb-2 text-sm font-semibold">
                Current Device Binding
              </h4>
              <div className="text-text-secondary grid grid-cols-2 gap-2 text-sm">
                <span className="text-text-muted">Status:</span>
                <Badge variant={deviceInfo.currentDeviceId ? "success" : "outline"} size="sm">
                  {deviceInfo.currentDeviceId ? "Bound" : "Unbound"}
                </Badge>
                <span className="text-text-muted">Device ID:</span>
                <span className="truncate font-mono text-xs">
                  {deviceInfo.currentDeviceId ?? "None"}
                </span>
                <span className="text-text-muted">Locked At:</span>
                <span>
                  {deviceInfo.deviceLockedAt
                    ? new Date(deviceInfo.deviceLockedAt).toLocaleString("en-IN")
                    : "N/A"}
                </span>
              </div>
            </div>

            {/* Device History */}
            <div>
              <h4 className="text-text-primary mb-2 text-sm font-semibold">
                Device History ({deviceInfo.devices.length})
              </h4>
              {deviceInfo.devices.length === 0 ? (
                <p className="text-text-muted text-sm">No device history recorded.</p>
              ) : (
                <div className="divide-border-default divide-y rounded-lg border">
                  {deviceInfo.devices.map((d) => (
                    <div key={d.id} className="flex items-center justify-between px-3 py-2 text-xs">
                      <div className="min-w-0 flex-1">
                        <p className="text-text-primary truncate font-mono">{d.deviceId}</p>
                        <p className="text-text-muted truncate">
                          {d.userAgent ?? "Unknown agent"}
                          {d.platform ? ` | ${d.platform}` : ""}
                          {d.screenSize ? ` | ${d.screenSize}` : ""}
                        </p>
                      </div>
                      <div className="ml-3 flex shrink-0 items-center gap-2">
                        <Badge variant={d.isActive ? "success" : "outline"} size="sm">
                          {d.isActive ? "Active" : "Inactive"}
                        </Badge>
                        <span className="text-text-muted whitespace-nowrap">
                          {new Date(d.lastSeen).toLocaleDateString("en-IN")}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recent Login History */}
            <div>
              <h4 className="text-text-primary mb-2 text-sm font-semibold">
                Recent Logins ({deviceInfo.recentLogins.length})
              </h4>
              {deviceInfo.recentLogins.length === 0 ? (
                <p className="text-text-muted text-sm">No login history.</p>
              ) : (
                <div className="divide-border-default max-h-60 divide-y overflow-y-auto rounded-lg border">
                  {deviceInfo.recentLogins.map((l) => (
                    <div key={l.id} className="flex items-center justify-between px-3 py-2 text-xs">
                      <div className="min-w-0 flex-1">
                        <p className="text-text-primary">
                          <Badge variant={l.success ? "success" : "danger"} size="sm">
                            {l.success ? "Success" : "Failed"}
                          </Badge>
                          {l.failureReason && (
                            <span className="text-text-muted ml-2">{l.failureReason}</span>
                          )}
                        </p>
                        <p className="text-text-muted mt-0.5 truncate">
                          Device: {l.attemptedDeviceId?.slice(0, 20) ?? "N/A"}...
                          {l.ip ? ` | IP: ${l.ip}` : ""}
                        </p>
                      </div>
                      <span className="text-text-muted ml-3 shrink-0 whitespace-nowrap">
                        {new Date(l.createdAt).toLocaleString("en-IN")}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
