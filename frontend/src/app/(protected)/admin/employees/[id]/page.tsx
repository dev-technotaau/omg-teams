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
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
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
  Select,
  Textarea,
} from "@/components/ui";
import { updateUser as updateUserApi } from "@/services/user.service";
import type { Column } from "@/components/ui";

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
];

export default function EmployeeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const employeeId = params.id as string;

  const [employee, setEmployee] = useState<EmployeeDetail | null>(null);
  const [activeTab, setActiveTab] = useState("profile");
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

  useEffect(() => {
    const fetchEmployee = async () => {
      try {
        const res = await api.get<{ user: EmployeeDetail }>(`/users/${employeeId}`);
        setEmployee(res.data.user);
      } catch {
        toast.error("Failed to load employee");
        router.push("/admin/employees");
      } finally {
        setIsLoading(false);
      }
    };
    void fetchEmployee();
  }, [employeeId, router]);

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
    if (activeTab !== "profile" && activeTab !== "performance") {
      void fetchTabData(activeTab);
    }
  }, [activeTab, fetchTabData]);

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
          <Button
            variant="outline"
            leftIcon={ArrowLeft}
            onClick={() => router.push("/admin/employees")}
          >
            Back
          </Button>
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
        onChange={setActiveTab}
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
            <Input
              id="edit-mobile"
              type="tel"
              value={editForm.mobileNumber}
              onChange={(e) => setEditForm((f) => ({ ...f, mobileNumber: e.target.value }))}
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
    </div>
  );
}
