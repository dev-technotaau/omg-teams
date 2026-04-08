"use client";

import { useState, useCallback } from "react";
import { useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { qk } from "@/lib/query-keys";
import {
  Pencil,
  Download,
  CheckCircle,
  XCircle,
  Clock as ClockIcon,
  Users,
  Timer,
  TrendingUp,
} from "lucide-react";
import { Card, Select } from "@/components/ui";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { exportToXLSX } from "@/utils/export-table";
import { SearchInput } from "@/components/ui/search-input";
import { TableSkeleton } from "@/components/ui/skeleton";
import { CalendarDatePicker } from "@/components/ui/calendar-date-picker";
import { TimePicker } from "@/components/ui/time-picker";
import { cn } from "@/lib/utils";
import { DEFAULT_LARGE_PAGE_SIZE } from "@/constants/pagination";
import { todayISO } from "@/utils/date";
import type { AttendanceRecord } from "@/types/attendance";
import type { PaginatedResponse } from "@/types/api";

// ──────────────────────────────────────────────
//  Admin Attendance Management — Spec Section 27.6
// ──────────────────────────────────────────────

const STATUS_OPTIONS = [
  { value: "", label: "All Statuses" },
  { value: "PRESENT_FULL", label: "Present (Full)" },
  { value: "PRESENT_HALF", label: "Present (Half)" },
  { value: "LATE", label: "Late" },
  { value: "ABSENT", label: "Absent" },
  { value: "INCOMPLETE", label: "Incomplete" },
  { value: "ON_LEAVE", label: "On Leave" },
  { value: "HOLIDAY", label: "Holiday" },
  { value: "WEEKEND", label: "Weekend" },
  { value: "OVERTIME", label: "Overtime" },
];

const ROLE_OPTIONS = [
  { value: "", label: "All Roles" },
  { value: "RECRUITER", label: "Recruiter" },
  { value: "REPORTING_MANAGER", label: "Reporting Manager" },
];

const QUICK_FILTERS = ["Today", "Yesterday", "This Week", "This Month"] as const;

function getQuickFilterDate(filter: string): string {
  const now = new Date();
  switch (filter) {
    case "Yesterday": {
      const d = new Date(now);
      d.setDate(d.getDate() - 1);
      return d.toISOString().split("T")[0]!;
    }
    default:
      return todayISO();
  }
}

function formatTime(ts: string | null): string {
  if (!ts) return "\u2014";
  return new Date(ts).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

function formatMinutes(mins: number | null): string {
  if (mins == null) return "\u2014";
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

export default function AdminAttendancePage() {
  const qc = useQueryClient();
  const [dateFilter, setDateFilter] = useState(todayISO());
  const [statusFilter, setStatusFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  // Edit modal state
  const [editTarget, setEditTarget] = useState<AttendanceRecord | null>(null);
  const [editPunchIn, setEditPunchIn] = useState("");
  const [editPunchOut, setEditPunchOut] = useState("");
  const [editStatus, setEditStatus] = useState("");
  const [editRemarks, setEditRemarks] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Server state — paginated, filtered attendance.
  const attendanceQuery = useQuery({
    queryKey: qk.attendance.list({ page, dateFilter, statusFilter }),
    queryFn: async () => {
      const params: Record<string, string> = {
        page: String(page),
        limit: String(DEFAULT_LARGE_PAGE_SIZE),
        date: dateFilter,
      };
      if (statusFilter) params.status = statusFilter;
      const res = await api.get<PaginatedResponse<AttendanceRecord>>("/attendance", { params });
      return res.data;
    },
    placeholderData: keepPreviousData,
  });
  const data = attendanceQuery.data ?? null;
  const isLoading = attendanceQuery.isLoading;

  const fetchData = useCallback(
    () => qc.invalidateQueries({ queryKey: qk.attendance.lists() }),
    [qc],
  );

  const openEdit = (record: AttendanceRecord) => {
    setEditTarget(record);
    setEditPunchIn(
      record.punchInTime ? new Date(record.punchInTime).toTimeString().slice(0, 5) : "",
    );
    setEditPunchOut(
      record.punchOutTime ? new Date(record.punchOutTime).toTimeString().slice(0, 5) : "",
    );
    setEditStatus(record.status);
    setEditRemarks(record.remarks ?? "");
  };

  const handleSaveEdit = async () => {
    if (!editTarget) return;
    setIsSaving(true);
    try {
      const payload: Record<string, string> = {};
      if (editPunchIn) payload.punchInTime = `${editTarget.date}T${editPunchIn}:00`;
      if (editPunchOut) payload.punchOutTime = `${editTarget.date}T${editPunchOut}:00`;
      if (editStatus) payload.status = editStatus;
      if (editRemarks) payload.remarks = editRemarks;

      await api.patch(`/attendance/${editTarget.id}`, payload);
      toast.success("Attendance updated");
      setEditTarget(null);
      void fetchData();
    } catch {
      toast.error("Failed to update attendance");
    } finally {
      setIsSaving(false);
    }
  };

  const records = data?.data ?? [];

  // Apply client-side filters (role + search)
  const filteredRecords = records.filter((r) => {
    if (roleFilter && r.user.role !== roleFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return `${r.user.firstName} ${r.user.lastName} ${r.user.employeeId ?? ""}`
        .toLowerCase()
        .includes(q);
    }
    return true;
  });

  // Summary counts from all records (before client-side filtering)
  const presentCount = records.filter((r) => r.status.startsWith("PRESENT")).length;
  const absentCount = records.filter((r) => r.status === "ABSENT").length;
  const lateCount = records.filter((r) => r.isLate).length;
  const halfDayCount = records.filter((r) => r.status === "PRESENT_HALF").length;
  const onLeaveCount = records.filter((r) => r.status === "ON_LEAVE").length;
  const avgHours = (() => {
    const presentRecords = records.filter(
      (r) => r.netWorkingMinutes != null && r.netWorkingMinutes > 0,
    );
    if (presentRecords.length === 0) return "\u2014";
    const avg =
      presentRecords.reduce((s, r) => s + (r.netWorkingMinutes ?? 0), 0) / presentRecords.length;
    return `${Math.floor(avg / 60)}h ${Math.round(avg % 60)}m`;
  })();

  const handleExport = () => {
    exportToXLSX(
      filteredRecords,
      [
        { header: "Employee", accessor: (r) => `${r.user.firstName} ${r.user.lastName}` },
        { header: "Employee ID", accessor: (r) => r.user.employeeId },
        { header: "Role", accessor: (r) => r.user.role.replace("_", " ") },
        { header: "Date", accessor: (r) => new Date(r.date).toLocaleDateString("en-IN") },
        { header: "Punch In", accessor: (r) => formatTime(r.punchInTime) },
        { header: "Punch Out", accessor: (r) => formatTime(r.punchOutTime) },
        { header: "Gross Hours", accessor: (r) => formatMinutes(r.grossWorkingMinutes) },
        { header: "Net Hours", accessor: (r) => formatMinutes(r.netWorkingMinutes) },
        { header: "Overtime", accessor: (r) => formatMinutes(r.overtimeMinutes) },
        { header: "Status", accessor: (r) => r.status.replace(/_/g, " ") },
        { header: "Late By", accessor: (r) => (r.lateByMinutes ? `${r.lateByMinutes}m` : "") },
        { header: "Remarks", accessor: (r) => r.remarks },
      ],
      `attendance-${dateFilter}`,
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-text-primary text-2xl font-bold">Attendance Management</h1>
        <button
          onClick={handleExport}
          className="bg-primary-500 hover:bg-primary-600 flex items-center gap-2 rounded-md px-4 py-2 text-sm text-white"
        >
          <Download size={14} /> Export XLSX
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Card padding="sm">
          <div className="flex items-center gap-3">
            <div className="bg-success-100 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
              <CheckCircle size={18} className="text-success-600" />
            </div>
            <div>
              <p className="text-text-muted text-xs">Present</p>
              <p className="text-success-600 text-xl font-bold">{presentCount}</p>
            </div>
          </div>
        </Card>
        <Card padding="sm">
          <div className="flex items-center gap-3">
            <div className="bg-error-100 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
              <XCircle size={18} className="text-error-600" />
            </div>
            <div>
              <p className="text-text-muted text-xs">Absent</p>
              <p className="text-error-600 text-xl font-bold">{absentCount}</p>
            </div>
          </div>
        </Card>
        <Card padding="sm">
          <div className="flex items-center gap-3">
            <div className="bg-warning-100 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
              <ClockIcon size={18} className="text-warning-600" />
            </div>
            <div>
              <p className="text-text-muted text-xs">Late</p>
              <p className="text-warning-600 text-xl font-bold">{lateCount}</p>
            </div>
          </div>
        </Card>
        <Card padding="sm">
          <div className="flex items-center gap-3">
            <div className="bg-warning-100 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
              <Timer size={18} className="text-warning-600" />
            </div>
            <div>
              <p className="text-text-muted text-xs">Half Day</p>
              <p className="text-warning-600 text-xl font-bold">{halfDayCount}</p>
            </div>
          </div>
        </Card>
        <Card padding="sm">
          <div className="flex items-center gap-3">
            <div className="bg-info-100 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
              <Users size={18} className="text-info-600" />
            </div>
            <div>
              <p className="text-text-muted text-xs">On Leave</p>
              <p className="text-info-600 text-xl font-bold">{onLeaveCount}</p>
            </div>
          </div>
        </Card>
        <Card padding="sm">
          <div className="flex items-center gap-3">
            <div className="bg-primary-100 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
              <TrendingUp size={18} className="text-primary-600" />
            </div>
            <div>
              <p className="text-text-muted text-xs">Avg Hours</p>
              <p className="text-primary-600 text-xl font-bold">{avgHours}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filters — quick range group + date + status/role + search, one row */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Grouped quick range + custom date picker */}
        <div className="border-border-default bg-bg-surface flex flex-wrap items-center gap-1 rounded-md border p-1">
          {QUICK_FILTERS.map((qf) => (
            <button
              key={qf}
              onClick={() => {
                setDateFilter(getQuickFilterDate(qf));
                setPage(1);
              }}
              className={cn(
                "rounded px-3 py-1.5 text-xs font-medium transition-colors",
                dateFilter === getQuickFilterDate(qf)
                  ? "bg-primary-500 text-white"
                  : "text-text-secondary hover:bg-bg-hover",
              )}
            >
              {qf}
            </button>
          ))}
          <div className="bg-border-default mx-1 h-6 w-px" aria-hidden="true" />
          <CalendarDatePicker
            value={dateFilter}
            onChange={(val) => {
              setDateFilter(val);
              setPage(1);
            }}
            showPresets
            size="sm"
            className="w-40"
          />
        </div>
        <Select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          options={STATUS_OPTIONS}
          className="w-44"
        />
        <Select
          value={roleFilter}
          onChange={(e) => {
            setRoleFilter(e.target.value);
            setPage(1);
          }}
          options={ROLE_OPTIONS}
          className="w-44"
        />
        <SearchInput
          value={search}
          onChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          placeholder="Filter by employee name..."
          historyKey="attendance"
          className="max-w-xs flex-1"
        />
      </div>

      {/* Table */}
      {isLoading ? (
        <TableSkeleton />
      ) : (
        <div className="border-border-default overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-bg-muted">
              <tr>
                <th className="text-text-secondary px-4 py-3 text-left font-medium">Employee</th>
                <th className="text-text-secondary px-4 py-3 text-left font-medium">Role</th>
                <th className="text-text-secondary px-4 py-3 text-left font-medium">Date</th>
                <th className="text-text-secondary px-4 py-3 text-left font-medium">Punch In</th>
                <th className="text-text-secondary px-4 py-3 text-left font-medium">Punch Out</th>
                <th className="text-text-secondary px-4 py-3 text-left font-medium">Gross Hours</th>
                <th className="text-text-secondary px-4 py-3 text-left font-medium">Net Hours</th>
                <th className="text-text-secondary px-4 py-3 text-left font-medium">Overtime</th>
                <th className="text-text-secondary px-4 py-3 text-left font-medium">Status</th>
                <th className="text-text-secondary px-4 py-3 text-left font-medium">Late By</th>
                <th className="text-text-secondary px-4 py-3 text-left font-medium">Remarks</th>
                <th className="text-text-secondary px-4 py-3 text-left font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-border-default divide-y">
              {filteredRecords.map((r) => (
                <tr key={r.id} className="hover:bg-bg-hover">
                  <td className="px-4 py-3">
                    <p className="text-text-primary font-medium">
                      {r.user.firstName} {r.user.lastName}
                    </p>
                    <p className="text-text-muted text-xs">{r.user.employeeId}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="bg-bg-muted rounded-sm px-2 py-0.5 text-xs">
                      {r.user.role.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="text-text-secondary px-4 py-3">
                    {new Date(r.date).toLocaleDateString("en-IN", {
                      day: "2-digit",
                      month: "short",
                    })}
                  </td>
                  <td className="text-text-secondary px-4 py-3">{formatTime(r.punchInTime)}</td>
                  <td className="text-text-secondary px-4 py-3">{formatTime(r.punchOutTime)}</td>
                  <td className="text-text-primary px-4 py-3">
                    {formatMinutes(r.grossWorkingMinutes)}
                  </td>
                  <td className="text-text-primary px-4 py-3">
                    {formatMinutes(r.netWorkingMinutes)}
                  </td>
                  <td className="text-text-primary px-4 py-3">
                    {r.overtimeMinutes && r.overtimeMinutes > 0
                      ? formatMinutes(r.overtimeMinutes)
                      : "\u2014"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-xs font-medium",
                        r.status.startsWith("PRESENT")
                          ? "bg-success-100 text-success-700"
                          : r.status === "LATE"
                            ? "bg-warning-100 text-warning-700"
                            : r.status === "ABSENT"
                              ? "bg-error-100 text-error-700"
                              : r.status === "ON_LEAVE"
                                ? "bg-info-100 text-info-700"
                                : r.status === "INCOMPLETE"
                                  ? "bg-warning-100 text-warning-700"
                                  : "bg-bg-muted text-text-muted",
                      )}
                    >
                      {r.status.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="text-text-muted px-4 py-3">
                    {r.isLate && r.lateByMinutes ? `${r.lateByMinutes}m` : "\u2014"}
                  </td>
                  <td className="text-text-muted max-w-[150px] truncate px-4 py-3 text-xs">
                    {r.remarks ?? "\u2014"}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => openEdit(r)}
                      className="text-primary-500 hover:bg-primary-100 rounded-sm p-1.5"
                      title="Edit"
                    >
                      <Pencil size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {data && data.pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-text-muted text-xs">
            Showing {(page - 1) * DEFAULT_LARGE_PAGE_SIZE + 1}
            {"\u2013"}
            {Math.min(page * DEFAULT_LARGE_PAGE_SIZE, data.pagination.total)} of{" "}
            {data.pagination.total}
          </p>
          <div className="flex gap-1">
            <button
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              className="border-border-default rounded-sm border px-3 py-1 text-sm disabled:opacity-50"
            >
              Previous
            </button>
            <button
              disabled={page >= data.pagination.totalPages}
              onClick={() => setPage(page + 1)}
              className="border-border-default rounded-sm border px-3 py-1 text-sm disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="bg-bg-overlay absolute inset-0" onClick={() => setEditTarget(null)} />
          <div className="border-border-default bg-bg-surface-raised relative z-10 w-full max-w-md rounded-lg border p-6 shadow-xl">
            <h3 className="text-text-primary text-lg font-semibold">Edit Attendance</h3>
            <p className="text-text-muted mt-1 text-sm">
              {editTarget.user.firstName} {editTarget.user.lastName} —{" "}
              {new Date(editTarget.date).toLocaleDateString("en-IN")}
            </p>

            <div className="mt-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-text-muted mb-1 block text-xs">Punch In</label>
                  <TimePicker value={editPunchIn} onChange={setEditPunchIn} size="md" />
                </div>
                <div>
                  <label className="text-text-muted mb-1 block text-xs">Punch Out</label>
                  <TimePicker value={editPunchOut} onChange={setEditPunchOut} size="md" />
                </div>
              </div>

              <div>
                <label className="text-text-muted mb-1 block text-xs">Status</label>
                <Select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  options={[
                    "PRESENT_FULL",
                    "PRESENT_HALF",
                    "LATE",
                    "ABSENT",
                    "INCOMPLETE",
                    "ON_LEAVE",
                    "HOLIDAY",
                    "WEEKEND",
                    "OVERTIME",
                  ].map((s) => ({ value: s, label: s.replace(/_/g, " ") }))}
                />
              </div>

              <div>
                <label className="text-text-muted mb-1 block text-xs">Remarks</label>
                <textarea
                  value={editRemarks}
                  onChange={(e) => setEditRemarks(e.target.value)}
                  rows={2}
                  placeholder="Optional remarks..."
                  className="border-border-default bg-bg-input w-full rounded-md border px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setEditTarget(null)}
                className="border-border-default rounded-md border px-4 py-2 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleSaveEdit()}
                disabled={isSaving}
                className="bg-primary-500 rounded-md px-4 py-2 text-sm text-white disabled:opacity-50"
              >
                {isSaving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
