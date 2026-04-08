"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  User,
  BarChart3,
  Calendar,
  CalendarDays,
  FileText,
  FolderOpen,
  Eye,
  EyeOff,
  Copy,
  Pencil,
  LogOut,
  MoreVertical,
} from "lucide-react";
import {
  GodviewTab,
  GODVIEW_TAB_ITEMS,
  GODVIEW_TAB_IDS,
  type GodviewTabId,
} from "./godview-tabs";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { qk } from "@/lib/query-keys";
import {
  PageHeader,
  Card,
  Badge,
  Avatar,
  Button,
  DataTable,
  Tabs,
  Progress,
  TableSkeleton,
  IconButton,
  Tooltip,
  Modal,
  FormField,
  Input,
  PhoneInput,
  Select,
  Textarea,
} from "@/components/ui";
import {
  updateUser as updateUserApi,
  suspendUser,
  reactivateUser,
  deleteUser as deleteUserApi,
  resetPassword as resetPasswordApi,
  resetDevice as resetDeviceApi,
  unlockAccount as unlockAccountApi,
  generateBackupCodes as generateBackupCodesApi,
  assignManager as assignManagerApi,
  removeManager as removeManagerApi,
} from "@/services/user.service";
import type { Column } from "@/components/ui";
import { useTabSearchParam } from "@/hooks";

// ──────────────────────────────────────────────
//  Employee Detail — Spec Section 6.4
//  6 tabs: Profile, Performance, Attendance, Leave, Documents, Reports
// ──────────────────────────────────────────────

interface EmployeeDetail {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  employeeId: string | null;
  role: string;
  status: string;
  mobileNumber: string | null;
  address: string | null;
  profilePhotoUrl: string | null;
  deviceId: string | null;
  createdAt: string;
  updatedAt: string;
  managedRecruiters?: Array<{ recruiter: { id: string; firstName: string; lastName: string } }>;
  managers?: Array<{ manager: { id: string; firstName: string; lastName: string } }>;
}

interface AttendanceRecord {
  id: string;
  date: string;
  punchInTime: string | null;
  punchOutTime: string | null;
  netWorkingMinutes: number | null;
  status: string;
  isLate: boolean;
  lateByMinutes: number | null;
}

interface LeaveRequest {
  id: string;
  startDate: string;
  endDate: string;
  numberOfDays: number;
  reason: string;
  status: string;
  leaveType: { name: string; code: string };
}

interface LeaveBalance {
  id: string;
  totalAllotted: number;
  used: number;
  remaining: number;
  leaveType: { name: string; code: string };
}

interface DocRecord {
  id: string;
  status: string;
  fileName: string | null;
  uploadedAt: string | null;
  documentType: { name: string };
}

interface CandidateRecord {
  id: string;
  globalSerialNumber: number;
  candidateName: string;
  contactNumber: string;
  zone: string;
  currentStage: string;
  status: string;
  createdAt: string;
}

const TAB_ITEMS = [
  { id: "profile", label: "Profile", icon: User },
  { id: "performance", label: "Performance", icon: BarChart3 },
  { id: "attendance", label: "Attendance", icon: Calendar },
  { id: "leave", label: "Leave", icon: CalendarDays },
  { id: "documents", label: "Documents", icon: FileText },
  { id: "reports", label: "Reports", icon: FolderOpen },
  ...GODVIEW_TAB_ITEMS,
];

const GODVIEW_TAB_ID_SET = new Set<string>(GODVIEW_TAB_IDS);

// All valid tab ids — base 6 + godview ids — for ?tab= URL sync.
const ALL_TAB_IDS = [
  "profile",
  "performance",
  "attendance",
  "leave",
  "documents",
  "reports",
  ...GODVIEW_TAB_IDS,
] as const;
type EmployeeTabId = (typeof ALL_TAB_IDS)[number];

export default function EmployeeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const employeeId = params.id as string;

  const [employee, setEmployee] = useState<EmployeeDetail | null>(null);
  // Active tab persisted in ?tab= so it survives reloads + back/forward
  const [activeTab, setActiveTab] = useTabSearchParam<EmployeeTabId>(
    "tab",
    "profile",
    ALL_TAB_IDS,
  );
  const [isLoading, setIsLoading] = useState(true);

  // Tab data
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [leaveBalances, setLeaveBalances] = useState<LeaveBalance[]>([]);
  const [documents, setDocuments] = useState<DocRecord[]>([]);
  const [reports, setReports] = useState<CandidateRecord[]>([]);
  const [tabLoading, setTabLoading] = useState(false);

  // Edit employee modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    mobileNumber: "",
    address: "",
    role: "" as "RECRUITER" | "REPORTING_MANAGER",
  });
  const [editSaving, setEditSaving] = useState(false);

  const openEditModal = () => {
    if (!employee) return;
    setEditForm({
      firstName: employee.firstName,
      lastName: employee.lastName,
      email: employee.email,
      mobileNumber: employee.mobileNumber ?? "",
      address: employee.address ?? "",
      role: employee.role as "RECRUITER" | "REPORTING_MANAGER",
    });
    setShowEditModal(true);
  };

  const handleEditSave = async () => {
    if (!employee) return;
    setEditSaving(true);
    try {
      const payload: Record<string, unknown> = {};
      if (editForm.firstName !== employee.firstName) payload["firstName"] = editForm.firstName;
      if (editForm.lastName !== employee.lastName) payload["lastName"] = editForm.lastName;
      if (editForm.email !== employee.email) payload["email"] = editForm.email;
      if (editForm.mobileNumber !== (employee.mobileNumber ?? ""))
        payload["mobileNumber"] = editForm.mobileNumber || null;
      if (editForm.address !== (employee.address ?? ""))
        payload["address"] = editForm.address || null;
      if (editForm.role !== employee.role) payload["role"] = editForm.role;

      if (Object.keys(payload).length === 0) {
        toast.info("No changes to save");
        setShowEditModal(false);
        setEditSaving(false);
        return;
      }

      const updated = await updateUserApi(
        employee.id,
        payload as Parameters<typeof updateUserApi>[1],
      );
      setEmployee((prev) => (prev ? { ...prev, ...updated } : prev));
      toast.success("Employee updated successfully");
      setShowEditModal(false);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        "Failed to update employee";
      toast.error(msg);
    } finally {
      setEditSaving(false);
    }
  };

  // §6.3.3 — Password view with admin verification
  const [showPwVerify, setShowPwVerify] = useState(false);
  const [pwVerifyAction, setPwVerifyAction] = useState<"view" | "copy">("view");
  const [revealedPassword, setRevealedPassword] = useState<string | null>(null);
  const [pwVerifiedAt, setPwVerifiedAt] = useState<number | null>(null);
  const cachedPasswordRef = useRef<string | null>(null); // keeps password for 5-min cache
  const autoHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const PW_CACHE_MS = 5 * 60 * 1000; // 5-minute cache
  const PW_AUTO_HIDE_MS = 30 * 1000; // 30-second auto-hide

  const isVerificationCached = pwVerifiedAt && Date.now() - pwVerifiedAt < PW_CACHE_MS;

  const handlePasswordAction = async (action: "view" | "copy") => {
    if (isVerificationCached && cachedPasswordRef.current) {
      const pw = cachedPasswordRef.current;
      if (action === "copy") {
        void navigator.clipboard.writeText(pw);
        toast.success("Password copied");
      } else {
        setRevealedPassword(pw);
        if (autoHideTimer.current) clearTimeout(autoHideTimer.current);
        autoHideTimer.current = setTimeout(() => setRevealedPassword(null), PW_AUTO_HIDE_MS);
      }
      return;
    }
    setPwVerifyAction(action);
    setShowPwVerify(true);
  };

  const handlePwVerifySubmit = async (formData: FormData) => {
    const adminPassword = formData.get("adminPassword") as string;
    try {
      const res = await api.post<{ password: string }>(`/users/${employeeId}/password`, {
        adminPassword,
      });
      const pw = res.data.password;
      cachedPasswordRef.current = pw;
      setRevealedPassword(pw);
      setPwVerifiedAt(Date.now());
      setShowPwVerify(false);
      if (pwVerifyAction === "copy") {
        void navigator.clipboard.writeText(pw);
        toast.success("Password copied");
      } else {
        if (autoHideTimer.current) clearTimeout(autoHideTimer.current);
        autoHideTimer.current = setTimeout(() => setRevealedPassword(null), PW_AUTO_HIDE_MS);
      }
      // Clear cached password after 5 minutes
      setTimeout(() => {
        cachedPasswordRef.current = null;
        setPwVerifiedAt(null);
      }, PW_CACHE_MS);
    } catch {
      toast.error("Invalid admin password");
    }
  };

  // Cleanup auto-hide timer
  useEffect(() => {
    return () => {
      if (autoHideTimer.current) clearTimeout(autoHideTimer.current);
    };
  }, []);

  // Server state — employee detail. We sync the cached row into local state
  // so the rest of the page (which mutates `employee` directly through
  // many setEmployee call sites) keeps working unchanged.
  const employeeQuery = useQuery({
    queryKey: qk.employees.detail(employeeId),
    queryFn: async () => {
      const res = await api.get<{ user: EmployeeDetail }>(`/users/${employeeId}`);
      return res.data.user;
    },
  });
  useEffect(() => {
    if (employeeQuery.data) {
      setEmployee(employeeQuery.data);
      setIsLoading(false);
    }
    if (employeeQuery.isError) {
      toast.error("Failed to load employee");
      router.push("/admin/employees");
    }
  }, [employeeQuery.data, employeeQuery.isError, router]);

  const fetchTabData = useCallback(
    async (tab: string) => {
      setTabLoading(true);
      try {
        switch (tab) {
          case "attendance": {
            const res = await api.get<{ data: AttendanceRecord[] }>(
              `/attendance?userId=${employeeId}&limit=50`,
            );
            setAttendance(res.data.data ?? []);
            break;
          }
          case "leave": {
            const [reqRes, balRes] = await Promise.all([
              api.get<{ data: LeaveRequest[] }>(`/leaves?userId=${employeeId}&limit=50`),
              api.get<{ balances: LeaveBalance[] }>(`/leaves/balances?userId=${employeeId}`),
            ]);
            setLeaves(reqRes.data.data ?? []);
            setLeaveBalances(balRes.data.balances ?? []);
            break;
          }
          case "documents": {
            const res = await api.get<{ data: DocRecord[] }>(`/documents?userId=${employeeId}`);
            setDocuments(res.data.data ?? []);
            break;
          }
          case "reports": {
            const res = await api.get<{ data: CandidateRecord[] }>(
              `/candidates?recruiterId=${employeeId}&limit=50`,
            );
            setReports(res.data.data ?? []);
            break;
          }
        }
      } catch {
        /* silent */
      } finally {
        setTabLoading(false);
      }
    },
    [employeeId],
  );

  useEffect(() => {
    if (
      activeTab !== "profile" &&
      activeTab !== "performance" &&
      !GODVIEW_TAB_ID_SET.has(activeTab)
    ) {
      void fetchTabData(activeTab);
    }
  }, [activeTab, fetchTabData]);

  // §Godview — presence (online/offline) polling + godview summary
  const [presence, setPresence] = useState<{
    status: "online" | "idle" | "offline";
    lastActiveAt: string | null;
  } | null>(null);
  const presenceQuery = useQuery({
    queryKey: ["presence", employeeId] as const,
    queryFn: async () => {
      const res = await api.get<{
        status: "online" | "idle" | "offline";
        lastActiveAt: string | null;
      }>(`/users/${employeeId}/presence`);
      return res.data;
    },
    refetchInterval: 30_000,
  });
  useEffect(() => {
    if (presenceQuery.data) setPresence(presenceQuery.data);
  }, [presenceQuery.data]);

  const [actionsOpen, setActionsOpen] = useState(false);
  const closeActions = () => setActionsOpen(false);
  const refreshEmployee = async () => {
    try {
      const res = await api.get<{ user: EmployeeDetail }>(`/users/${employeeId}`);
      setEmployee(res.data.user);
    } catch {
      /* silent */
    }
  };

  const handleForceLogout = async () => {
    if (!confirm("Force-logout this employee from all sessions?")) return;
    try {
      const res = await api.post<{ revoked: number }>(`/users/${employeeId}/force-logout`, {});
      toast.success(`${res.data.revoked} session(s) revoked`);
      closeActions();
    } catch {
      toast.error("Failed to force logout");
    }
  };

  const handleSuspend = async () => {
    if (!confirm("Suspend this employee? They will be unable to log in.")) return;
    try {
      await suspendUser(employeeId);
      toast.success("Employee suspended");
      await refreshEmployee();
      closeActions();
    } catch {
      toast.error("Failed to suspend");
    }
  };

  const handleReactivate = async () => {
    try {
      await reactivateUser(employeeId);
      toast.success("Employee reactivated");
      await refreshEmployee();
      closeActions();
    } catch {
      toast.error("Failed to reactivate");
    }
  };

  const handleResetPassword = async () => {
    const pw = prompt("Enter new password (min 8 characters):");
    if (!pw) return;
    if (pw.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    try {
      await resetPasswordApi(employeeId, pw);
      toast.success("Password reset");
      closeActions();
    } catch {
      toast.error("Failed to reset password");
    }
  };

  const handleResetDevice = async () => {
    if (!confirm("Reset the device binding for this employee?")) return;
    try {
      await resetDeviceApi(employeeId);
      toast.success("Device reset");
      await refreshEmployee();
      closeActions();
    } catch {
      toast.error("Failed to reset device");
    }
  };

  const handleReactivateWithDeviceReset = async () => {
    if (!confirm("Reactivate this employee AND reset their device binding?")) return;
    try {
      await api.post(`/users/${employeeId}/reactivate-with-device-reset`, {});
      toast.success("Reactivated with device reset");
      await refreshEmployee();
      closeActions();
    } catch {
      toast.error("Failed to reactivate with device reset");
    }
  };

  const handleUnlock = async () => {
    try {
      await unlockAccountApi(employeeId);
      toast.success("Account unlocked");
      closeActions();
    } catch {
      toast.error("Failed to unlock");
    }
  };

  // §Godview — Manager/Recruiter assignment modal
  // mode: "assign-manager"    = add an RM to this recruiter
  //       "remove-manager"    = remove an RM from this recruiter
  //       "assign-recruiter"  = add a recruiter under this RM
  //       "remove-recruiter"  = remove a recruiter from this RM
  const [assignmentModal, setAssignmentModal] = useState<
    null | "assign-manager" | "remove-manager" | "assign-recruiter" | "remove-recruiter"
  >(null);
  const [assignmentOptions, setAssignmentOptions] = useState<
    Array<{ id: string; firstName: string; lastName: string; employeeId: string | null }>
  >([]);
  const [assignmentLoading, setAssignmentLoading] = useState(false);
  const [assignmentSelected, setAssignmentSelected] = useState<string>("");

  const openAssignmentModal = async (
    mode: "assign-manager" | "remove-manager" | "assign-recruiter" | "remove-recruiter",
  ) => {
    setAssignmentModal(mode);
    setAssignmentSelected("");
    closeActions();
    setAssignmentLoading(true);
    try {
      if (mode === "assign-manager") {
        // All active RMs not already assigned to this recruiter
        const res = await api.get<{
          data: Array<{ id: string; firstName: string; lastName: string; employeeId: string | null }>;
        }>("/users?role=REPORTING_MANAGER&status=ACTIVE&limit=500");
        const assignedIds = new Set((employee?.managers ?? []).map((m) => m.manager.id));
        setAssignmentOptions((res.data.data ?? []).filter((u) => !assignedIds.has(u.id)));
      } else if (mode === "remove-manager") {
        setAssignmentOptions(
          (employee?.managers ?? []).map((m) => ({
            id: m.manager.id,
            firstName: m.manager.firstName,
            lastName: m.manager.lastName,
            employeeId: null,
          })),
        );
      } else if (mode === "assign-recruiter") {
        const res = await api.get<{
          data: Array<{ id: string; firstName: string; lastName: string; employeeId: string | null }>;
        }>("/users?role=RECRUITER&status=ACTIVE&limit=500");
        const assignedIds = new Set(
          (employee?.managedRecruiters ?? []).map((r) => r.recruiter.id),
        );
        setAssignmentOptions((res.data.data ?? []).filter((u) => !assignedIds.has(u.id)));
      } else {
        // remove-recruiter
        setAssignmentOptions(
          (employee?.managedRecruiters ?? []).map((r) => ({
            id: r.recruiter.id,
            firstName: r.recruiter.firstName,
            lastName: r.recruiter.lastName,
            employeeId: null,
          })),
        );
      }
    } catch {
      toast.error("Failed to load options");
    } finally {
      setAssignmentLoading(false);
    }
  };

  const submitAssignment = async () => {
    if (!assignmentSelected || !assignmentModal) return;
    try {
      if (assignmentModal === "assign-manager") {
        await assignManagerApi(employeeId, assignmentSelected);
        toast.success("Manager assigned");
      } else if (assignmentModal === "remove-manager") {
        await removeManagerApi(employeeId, assignmentSelected);
        toast.success("Manager removed");
      } else if (assignmentModal === "assign-recruiter") {
        // For RM-side assignment, the relation is still recruiter→manager,
        // so we call assign with recruiterId=selected, managerId=current employee.
        await assignManagerApi(assignmentSelected, employeeId);
        toast.success("Recruiter assigned");
      } else {
        await removeManagerApi(assignmentSelected, employeeId);
        toast.success("Recruiter removed");
      }
      await refreshEmployee();
      setAssignmentModal(null);
    } catch {
      toast.error("Failed to update assignment");
    }
  };

  const handleGenerateBackupCodes = async () => {
    if (!confirm("Generate new backup codes? Old codes will be invalidated.")) return;
    try {
      const { codes } = await generateBackupCodesApi(employeeId);
      alert(`New backup codes (store securely):\n\n${codes.join("\n")}`);
      closeActions();
    } catch {
      toast.error("Failed to generate backup codes");
    }
  };

  const handleResetMfa = async () => {
    if (
      !confirm(
        "Reset MFA? All WebAuthn credentials and backup codes will be deleted. User will need to re-enroll.",
      )
    )
      return;
    try {
      const res = await api.post<{ webauthn: number; backup: number }>(
        `/users/${employeeId}/reset-mfa`,
        {},
      );
      toast.success(
        `MFA reset: ${res.data.webauthn} credential(s) and ${res.data.backup} backup code(s) removed`,
      );
      closeActions();
    } catch {
      toast.error("Failed to reset MFA");
    }
  };

  const handleDelete = async () => {
    if (
      !confirm(
        "PERMANENTLY delete this employee? This cannot be undone. All related records will be cascade-deleted.",
      )
    )
      return;
    if (!confirm("Are you absolutely sure? Type the employee name to confirm in the next step.")) return;
    const typed = prompt(`Type "${employee?.firstName} ${employee?.lastName}" to confirm:`);
    if (typed !== `${employee?.firstName} ${employee?.lastName}`) {
      toast.error("Confirmation mismatch, cancelled");
      return;
    }
    try {
      await deleteUserApi(employeeId);
      toast.success("Employee deleted");
      router.push("/admin/employees");
    } catch {
      toast.error("Failed to delete");
    }
  };

  if (isLoading) return <TableSkeleton />;
  if (!employee) return null;

  const name = `${employee.firstName} ${employee.lastName}`;

  const attendanceCols: Column<AttendanceRecord>[] = [
    {
      key: "date",
      header: "Date",
      cell: (r) =>
        new Date(r.date).toLocaleDateString("en-IN", {
          weekday: "short",
          day: "numeric",
          month: "short",
        }),
    },
    {
      key: "punchIn",
      header: "Punch In",
      cell: (r) =>
        r.punchInTime
          ? new Date(r.punchInTime).toLocaleTimeString("en-IN", {
              hour: "2-digit",
              minute: "2-digit",
            })
          : "\u2014",
    },
    {
      key: "punchOut",
      header: "Punch Out",
      cell: (r) =>
        r.punchOutTime
          ? new Date(r.punchOutTime).toLocaleTimeString("en-IN", {
              hour: "2-digit",
              minute: "2-digit",
            })
          : "\u2014",
    },
    {
      key: "hours",
      header: "Hours",
      cell: (r) =>
        r.netWorkingMinutes != null
          ? `${Math.floor(r.netWorkingMinutes / 60)}h ${r.netWorkingMinutes % 60}m`
          : "\u2014",
    },
    {
      key: "status",
      header: "Status",
      cell: (r) => (
        <Badge
          variant={
            r.status.startsWith("PRESENT")
              ? "success"
              : r.status === "ABSENT"
                ? "danger"
                : "warning"
          }
        >
          {r.status.replace("_", " ")}
        </Badge>
      ),
    },
    {
      key: "late",
      header: "Late",
      cell: (r) => (r.isLate && r.lateByMinutes ? `${r.lateByMinutes}m` : "\u2014"),
    },
  ];

  const leaveCols: Column<LeaveRequest>[] = [
    {
      key: "type",
      header: "Type",
      cell: (r) => (
        <Badge variant="primary" size="sm">
          {r.leaveType.name}
        </Badge>
      ),
    },
    {
      key: "dates",
      header: "Dates",
      cell: (r) =>
        `${new Date(r.startDate).toLocaleDateString("en-IN")} \u2014 ${new Date(r.endDate).toLocaleDateString("en-IN")}`,
    },
    { key: "days", header: "Days", cell: (r) => r.numberOfDays },
    {
      key: "reason",
      header: "Reason",
      cell: (r) => <span className="block max-w-xs truncate text-xs">{r.reason}</span>,
    },
    {
      key: "status",
      header: "Status",
      cell: (r) => (
        <Badge
          variant={
            r.status === "APPROVED" ? "success" : r.status === "REJECTED" ? "danger" : "warning"
          }
        >
          {r.status}
        </Badge>
      ),
    },
  ];

  const reportCols: Column<CandidateRecord>[] = [
    { key: "gsn", header: "#", cell: (r) => r.globalSerialNumber },
    { key: "name", header: "Candidate", cell: (r) => r.candidateName },
    { key: "contact", header: "Contact", cell: (r) => r.contactNumber },
    {
      key: "zone",
      header: "Zone",
      cell: (r) => (
        <Badge variant="outline" size="sm">
          {r.zone}
        </Badge>
      ),
    },
    {
      key: "stage",
      header: "Stage",
      cell: (r) => (
        <Badge variant="primary" size="sm">
          {r.currentStage.replace("_", " ")}
        </Badge>
      ),
    },
    {
      key: "status",
      header: "Status",
      cell: (r) => (
        <Badge variant={r.status === "COMPLETE" ? "success" : "warning"} size="sm">
          {r.status}
        </Badge>
      ),
    },
    { key: "date", header: "Date", cell: (r) => new Date(r.createdAt).toLocaleDateString("en-IN") },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={name}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              leftIcon={ArrowLeft}
              onClick={() => router.push("/admin/employees")}
            >
              Back
            </Button>
            {/* §Godview — consolidated admin actions */}
            <div className="relative">
              <Button
                variant="outline"
                leftIcon={MoreVertical}
                onClick={() => setActionsOpen((v) => !v)}
              >
                Actions
              </Button>
              {actionsOpen && (
                <div
                  className="border-border-default bg-bg-surface-raised absolute right-0 z-20 mt-2 w-64 divide-y divide-border-default rounded-lg border shadow-xl"
                  onMouseLeave={() => setActionsOpen(false)}
                >
                  <div>
                    <button
                      type="button"
                      onClick={() => {
                        closeActions();
                        openEditModal();
                      }}
                      className="hover:bg-bg-hover flex w-full items-center gap-2 px-3 py-2 text-sm"
                    >
                      <Pencil size={14} /> Edit Profile
                    </button>
                  </div>
                  <div>
                    {employee.status === "ACTIVE" ? (
                      <button
                        type="button"
                        onClick={() => void handleSuspend()}
                        className="hover:bg-bg-hover flex w-full items-center gap-2 px-3 py-2 text-sm text-warning-600"
                      >
                        Suspend Employee
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void handleReactivate()}
                        className="hover:bg-bg-hover flex w-full items-center gap-2 px-3 py-2 text-sm text-success-600"
                      >
                        Reactivate Employee
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => void handleReactivateWithDeviceReset()}
                      className="hover:bg-bg-hover flex w-full items-center gap-2 px-3 py-2 text-sm"
                    >
                      Reactivate + Reset Device
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleUnlock()}
                      className="hover:bg-bg-hover flex w-full items-center gap-2 px-3 py-2 text-sm"
                    >
                      Unlock Account
                    </button>
                  </div>
                  <div>
                    <button
                      type="button"
                      onClick={() => void handleResetPassword()}
                      className="hover:bg-bg-hover flex w-full items-center gap-2 px-3 py-2 text-sm"
                    >
                      Reset Password
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleResetDevice()}
                      className="hover:bg-bg-hover flex w-full items-center gap-2 px-3 py-2 text-sm"
                    >
                      Reset Device
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleGenerateBackupCodes()}
                      className="hover:bg-bg-hover flex w-full items-center gap-2 px-3 py-2 text-sm"
                    >
                      Generate Backup Codes
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleResetMfa()}
                      className="hover:bg-bg-hover flex w-full items-center gap-2 px-3 py-2 text-sm"
                    >
                      Reset MFA
                    </button>
                  </div>
                  <div>
                    {employee.role === "RECRUITER" && (
                      <>
                        <button
                          type="button"
                          onClick={() => void openAssignmentModal("assign-manager")}
                          className="hover:bg-bg-hover flex w-full items-center gap-2 px-3 py-2 text-sm"
                        >
                          Assign Reporting Manager
                        </button>
                        <button
                          type="button"
                          onClick={() => void openAssignmentModal("remove-manager")}
                          className="hover:bg-bg-hover flex w-full items-center gap-2 px-3 py-2 text-sm"
                          disabled={!employee.managers?.length}
                        >
                          Remove Reporting Manager
                        </button>
                      </>
                    )}
                    {employee.role === "REPORTING_MANAGER" && (
                      <>
                        <button
                          type="button"
                          onClick={() => void openAssignmentModal("assign-recruiter")}
                          className="hover:bg-bg-hover flex w-full items-center gap-2 px-3 py-2 text-sm"
                        >
                          Assign Recruiter
                        </button>
                        <button
                          type="button"
                          onClick={() => void openAssignmentModal("remove-recruiter")}
                          className="hover:bg-bg-hover flex w-full items-center gap-2 px-3 py-2 text-sm"
                          disabled={!employee.managedRecruiters?.length}
                        >
                          Remove Recruiter
                        </button>
                      </>
                    )}
                  </div>
                  <div>
                    <button
                      type="button"
                      onClick={() => void handleForceLogout()}
                      className="hover:bg-bg-hover flex w-full items-center gap-2 px-3 py-2 text-sm text-error-600"
                    >
                      <LogOut size={14} /> Force Logout All Sessions
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDelete()}
                      className="hover:bg-bg-hover flex w-full items-center gap-2 px-3 py-2 text-sm text-error-600"
                    >
                      Delete Employee
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        }
      />

      {/* Header Card */}
      <Card>
        <div className="flex items-center gap-6">
          <Avatar
            name={name}
            src={employee.profilePhotoUrl}
            size="xl"
            className="h-20 w-20 text-xl"
          />
          <div className="flex-1 space-y-1">
            <div className="flex items-center gap-2">
              <h2 className="text-text-primary text-xl font-bold">{name}</h2>
              <Badge variant={employee.status === "ACTIVE" ? "success" : "danger"} dot>
                {employee.status}
              </Badge>
              {presence && (
                <Badge
                  variant={
                    presence.status === "online"
                      ? "success"
                      : presence.status === "idle"
                        ? "warning"
                        : "default"
                  }
                  dot
                >
                  {presence.status === "online"
                    ? "Online"
                    : presence.status === "idle"
                      ? "Idle"
                      : "Offline"}
                </Badge>
              )}
              {presence?.lastActiveAt && presence.status !== "online" && (
                <span className="text-text-muted text-xs">
                  Last active {new Date(presence.lastActiveAt).toLocaleString("en-IN")}
                </span>
              )}
            </div>
            <p className="text-text-muted text-sm">{employee.email}</p>
            <div className="text-text-secondary flex flex-wrap gap-3 text-xs">
              <span>
                ID: <strong className="font-mono">{employee.employeeId ?? "\u2014"}</strong>
              </span>
              <span>
                Role:{" "}
                <Badge variant="default" size="sm">
                  {employee.role.replace("_", " ")}
                </Badge>
              </span>
              <span>Phone: {employee.mobileNumber ?? "\u2014"}</span>
              <span>
                Device:{" "}
                <Badge variant={employee.deviceId ? "success" : "default"} size="sm">
                  {employee.deviceId ? "Bound" : "Unbound"}
                </Badge>
              </span>
              <span>Joined: {new Date(employee.createdAt).toLocaleDateString("en-IN")}</span>
            </div>
            {employee.managers && employee.managers.length > 0 && (
              <p className="text-text-muted text-xs">
                RM(s):{" "}
                {employee.managers
                  .map((m) => `${m.manager.firstName} ${m.manager.lastName}`)
                  .join(", ")}
              </p>
            )}
          </div>
        </div>
      </Card>

      {/* Tabs */}
      <Tabs
        tabs={TAB_ITEMS.map((t) => ({ id: t.id, label: t.label }))}
        activeTab={activeTab}
        onChange={(id) => setActiveTab(id as EmployeeTabId)}
      />

      {/* Tab Content */}
      {activeTab === "profile" && (
        <div className="space-y-4">
          <Card>
            <Card.Header>
              <div className="flex items-center justify-between">
                <h3 className="text-text-secondary text-sm font-medium">Personal Information</h3>
                {employee.role !== "ADMIN" && (
                  <Button variant="outline" size="sm" leftIcon={Pencil} onClick={openEditModal}>
                    Edit
                  </Button>
                )}
              </div>
            </Card.Header>
            <Card.Body>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
                {[
                  ["First Name", employee.firstName],
                  ["Last Name", employee.lastName],
                  ["Email", employee.email],
                  ["Role", employee.role.replace("_", " ")],
                  ["Status", employee.status],
                  ["Mobile", employee.mobileNumber],
                  ["Address", employee.address],
                  ["Device ID", employee.deviceId ? `${employee.deviceId.slice(0, 8)}...` : null],
                  ["Created", new Date(employee.createdAt).toLocaleDateString("en-IN")],
                  ["Updated", new Date(employee.updatedAt).toLocaleDateString("en-IN")],
                ].map(([label, value]) => (
                  <div key={label as string}>
                    <p className="text-text-muted text-xs">{label}</p>
                    <p className="text-text-primary mt-0.5 text-sm font-medium">
                      {(value as string) ?? "\u2014"}
                    </p>
                  </div>
                ))}
              </div>
            </Card.Body>
          </Card>

          {/* §6.3.3 — Employee ID & Password (Gaps 9, 10) */}
          <Card>
            <Card.Header>
              <h3 className="text-text-secondary text-sm font-medium">Credentials</h3>
            </Card.Header>
            <Card.Body>
              <div className="space-y-4">
                {/* Employee ID with copy */}
                <div>
                  <p className="text-text-muted text-xs">Employee ID</p>
                  <div className="mt-0.5 flex items-center gap-2">
                    <code className="bg-bg-muted rounded-sm px-2 py-1 font-mono text-sm font-medium">
                      {employee.employeeId ?? "\u2014"}
                    </code>
                    {employee.employeeId && (
                      <Tooltip content="Copy Employee ID">
                        <IconButton
                          icon={Copy}
                          aria-label="Copy Employee ID"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            void navigator.clipboard.writeText(employee.employeeId!);
                            toast.success("Employee ID copied");
                          }}
                        />
                      </Tooltip>
                    )}
                  </div>
                </div>

                {/* Password with admin verification */}
                <div>
                  <p className="text-text-muted text-xs">Password</p>
                  <div className="mt-0.5 flex items-center gap-2">
                    <code className="bg-bg-muted rounded-sm px-2 py-1 font-mono text-sm">
                      {revealedPassword ??
                        "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022"}
                    </code>
                    <Tooltip content={revealedPassword ? "Hide password" : "View password"}>
                      <IconButton
                        icon={revealedPassword ? EyeOff : Eye}
                        aria-label={revealedPassword ? "Hide password" : "View password"}
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (revealedPassword) {
                            setRevealedPassword(null);
                            if (autoHideTimer.current) clearTimeout(autoHideTimer.current);
                          } else {
                            void handlePasswordAction("view");
                          }
                        }}
                      />
                    </Tooltip>
                    <Tooltip content="Copy password">
                      <IconButton
                        icon={Copy}
                        aria-label="Copy password"
                        variant="ghost"
                        size="sm"
                        onClick={() => void handlePasswordAction("copy")}
                      />
                    </Tooltip>
                  </div>
                  {isVerificationCached && (
                    <p className="text-text-muted mt-1 text-xs">
                      Verification cached (expires in{" "}
                      {Math.ceil((PW_CACHE_MS - (Date.now() - pwVerifiedAt!)) / 60000)} min)
                    </p>
                  )}
                </div>
              </div>
            </Card.Body>
          </Card>

          {/* Assigned Managers / Managed Recruiters */}
          {employee.managers && employee.managers.length > 0 && (
            <Card>
              <Card.Header>
                <h3 className="text-text-secondary text-sm font-medium">
                  Assigned Reporting Managers
                </h3>
              </Card.Header>
              <Card.Body>
                <div className="flex flex-wrap gap-2">
                  {employee.managers.map((m) => (
                    <Badge key={m.manager.id} variant="default">
                      {m.manager.firstName} {m.manager.lastName}
                    </Badge>
                  ))}
                </div>
              </Card.Body>
            </Card>
          )}

          {employee.managedRecruiters && employee.managedRecruiters.length > 0 && (
            <Card>
              <Card.Header>
                <h3 className="text-text-secondary text-sm font-medium">Managed Recruiters</h3>
              </Card.Header>
              <Card.Body>
                <div className="flex flex-wrap gap-2">
                  {employee.managedRecruiters.map((r) => (
                    <Badge key={r.recruiter.id} variant="default">
                      {r.recruiter.firstName} {r.recruiter.lastName}
                    </Badge>
                  ))}
                </div>
              </Card.Body>
            </Card>
          )}
        </div>
      )}

      {/* §Godview — Assignment modal (assign/remove manager/recruiter) */}
      <Modal
        open={assignmentModal !== null}
        onClose={() => setAssignmentModal(null)}
        title={
          assignmentModal === "assign-manager"
            ? "Assign Reporting Manager"
            : assignmentModal === "remove-manager"
              ? "Remove Reporting Manager"
              : assignmentModal === "assign-recruiter"
                ? "Assign Recruiter"
                : assignmentModal === "remove-recruiter"
                  ? "Remove Recruiter"
                  : ""
        }
        size="sm"
      >
        <div className="space-y-3">
          {assignmentLoading ? (
            <p className="text-text-muted text-sm">Loading options…</p>
          ) : assignmentOptions.length === 0 ? (
            <p className="text-text-muted text-sm">
              {assignmentModal?.startsWith("remove")
                ? "No current assignments to remove."
                : "No eligible users available."}
            </p>
          ) : (
            <FormField
              label={
                assignmentModal?.includes("manager") ? "Reporting Manager" : "Recruiter"
              }
              htmlFor="assignment-select"
              required
            >
              <Select
                id="assignment-select"
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
            <Button variant="outline" onClick={() => setAssignmentModal(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => void submitAssignment()}
              disabled={!assignmentSelected || assignmentLoading}
            >
              Confirm
            </Button>
          </div>
        </div>
      </Modal>

      {/* Admin Password Verification Modal — §6.3.3 */}
      <Modal
        open={showPwVerify}
        onClose={() => setShowPwVerify(false)}
        title="Admin Password Verification"
        size="sm"
      >
        <form action={handlePwVerifySubmit}>
          <p className="text-text-secondary mb-4 text-sm">
            Enter your admin password to {pwVerifyAction === "view" ? "view" : "copy"} this
            employee&apos;s password.
          </p>
          <FormField label="Admin Password" htmlFor="adminPassword" required>
            <Input
              id="adminPassword"
              name="adminPassword"
              type="password"
              placeholder="Your admin password"
              required
              autoFocus
            />
          </FormField>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowPwVerify(false)}>
              Cancel
            </Button>
            <Button type="submit">Verify</Button>
          </div>
        </form>
      </Modal>

      {/* Edit Employee Modal */}
      <Modal
        open={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="Edit Employee"
        size="md"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="First Name" htmlFor="edit-firstName" required>
              <Input
                id="edit-firstName"
                value={editForm.firstName}
                onChange={(e) => setEditForm((f) => ({ ...f, firstName: e.target.value }))}
              />
            </FormField>
            <FormField label="Last Name" htmlFor="edit-lastName" required>
              <Input
                id="edit-lastName"
                value={editForm.lastName}
                onChange={(e) => setEditForm((f) => ({ ...f, lastName: e.target.value }))}
              />
            </FormField>
          </div>

          <FormField label="Email" htmlFor="edit-email" required>
            <Input
              id="edit-email"
              type="email"
              value={editForm.email}
              onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
            />
          </FormField>

          <FormField label="Mobile Number" htmlFor="edit-mobile">
            <PhoneInput
              id="edit-mobile"
              value={editForm.mobileNumber}
              onChange={(v) => setEditForm((f) => ({ ...f, mobileNumber: v }))}
              placeholder="Enter mobile number"
            />
          </FormField>

          <FormField label="Address" htmlFor="edit-address">
            <Textarea
              id="edit-address"
              value={editForm.address}
              onChange={(e) => setEditForm((f) => ({ ...f, address: e.target.value }))}
              placeholder="Enter address"
              rows={2}
            />
          </FormField>

          <FormField label="Role" htmlFor="edit-role" required>
            <Select
              id="edit-role"
              value={editForm.role}
              onChange={(e) =>
                setEditForm((f) => ({
                  ...f,
                  role: e.target.value as "RECRUITER" | "REPORTING_MANAGER",
                }))
              }
              options={[
                { value: "RECRUITER", label: "Recruiter" },
                { value: "REPORTING_MANAGER", label: "Reporting Manager" },
              ]}
            />
          </FormField>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setShowEditModal(false)}>
              Cancel
            </Button>
            <Button loading={editSaving} onClick={() => void handleEditSave()}>
              Save Changes
            </Button>
          </div>
        </div>
      </Modal>

      {activeTab === "performance" && (
        <Card>
          <Card.Header>
            <h3 className="text-text-secondary text-sm font-medium">Performance Overview</h3>
          </Card.Header>
          <Card.Body>
            <p className="text-text-muted text-sm">
              Performance metrics are calculated from candidate reports, attendance, and target
              data. Switch to the Reports, Attendance, or Leave tabs for detailed views.
            </p>
          </Card.Body>
        </Card>
      )}

      {activeTab === "attendance" &&
        (tabLoading ? (
          <TableSkeleton />
        ) : (
          <DataTable
            columns={attendanceCols}
            data={attendance}
            emptyTitle="No attendance records"
            emptyDescription="No attendance data found for this employee."
          />
        ))}

      {activeTab === "leave" &&
        (tabLoading ? (
          <TableSkeleton />
        ) : (
          <div className="space-y-4">
            {leaveBalances.length > 0 && (
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
                {leaveBalances.map((b) => (
                  <Card key={b.id} className="text-center">
                    <p className="text-text-muted text-xs font-medium">{b.leaveType.code}</p>
                    <p className="text-text-primary mt-1 text-lg font-bold">
                      {b.remaining}/{b.totalAllotted}
                    </p>
                    <Progress
                      value={b.remaining}
                      max={b.totalAllotted > 0 ? b.totalAllotted : 1}
                      size="sm"
                      className="mt-2"
                    />
                  </Card>
                ))}
              </div>
            )}
            <DataTable
              columns={leaveCols}
              data={leaves}
              emptyTitle="No leave requests"
              emptyDescription="No leave data found."
            />
          </div>
        ))}

      {activeTab === "documents" &&
        (tabLoading ? (
          <TableSkeleton />
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {documents.length === 0 ? (
              <Card className="col-span-full py-12 text-center">
                <p className="text-text-muted text-sm">No documents uploaded</p>
              </Card>
            ) : (
              documents.map((d) => (
                <Card key={d.id} className="flex items-center justify-between">
                  <div>
                    <p className="text-text-primary text-sm font-medium">{d.documentType.name}</p>
                    <p className="text-text-muted text-xs">{d.fileName ?? "No file"}</p>
                  </div>
                  <Badge
                    variant={
                      d.status === "VERIFIED"
                        ? "success"
                        : d.status === "REJECTED"
                          ? "danger"
                          : "warning"
                    }
                    size="sm"
                  >
                    {d.status}
                  </Badge>
                </Card>
              ))
            )}
          </div>
        ))}

      {activeTab === "reports" &&
        (tabLoading ? (
          <TableSkeleton />
        ) : (
          <DataTable
            columns={reportCols}
            data={reports}
            emptyTitle="No candidate reports"
            emptyDescription="No reports submitted by this employee."
          />
        ))}

      {/* §Godview — new administrative tabs */}
      {GODVIEW_TAB_ID_SET.has(activeTab) && (
        <GodviewTab tab={activeTab as GodviewTabId} userId={employeeId} />
      )}
    </div>
  );
}
