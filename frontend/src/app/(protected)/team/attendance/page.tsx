"use client";

import { useState, useEffect, useCallback } from "react";
import { Calendar } from "lucide-react";
import { api } from "@/lib/api";
import { TableSkeleton } from "@/components/ui/skeleton";
import { CalendarDatePicker } from "@/components/ui/calendar-date-picker";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import { DEFAULT_LARGE_PAGE_SIZE } from "@/constants/pagination";
import { todayISO } from "@/utils/date";
import type { AttendanceRecord } from "@/types/attendance";
import type { PaginatedResponse } from "@/types/api";

// ──────────────────────────────────────────────
//  Team Attendance View — Spec Section 27.8
//  Read-only view for Reporting Managers
// ──────────────────────────────────────────────

export default function TeamAttendancePage() {
  const [data, setData] = useState<PaginatedResponse<AttendanceRecord> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState(todayISO());
  const [page, setPage] = useState(1);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const params: Record<string, string> = {
        page: String(page),
        limit: String(DEFAULT_LARGE_PAGE_SIZE),
        date: dateFilter,
      };
      const res = await api.get<PaginatedResponse<AttendanceRecord>>("/attendance/team", {
        params,
      });
      setData(res.data);
    } catch {
      /* silent */
    } finally {
      setIsLoading(false);
    }
  }, [page, dateFilter]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const records = data?.data ?? [];
  const presentCount = records.filter((r) => r.status.startsWith("PRESENT")).length;
  const absentCount = records.filter((r) => r.status === "ABSENT").length;
  const lateCount = records.filter((r) => r.isLate).length;
  const onLeaveCount = records.filter((r) => r.status === "ON_LEAVE").length;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-text-primary text-2xl font-bold">Team Attendance</h1>
        <p className="text-text-secondary mt-1 text-sm">
          View attendance data for your assigned recruiters (read-only)
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          {
            label: "Present",
            value: presentCount,
            color: "text-success-500",
            bg: "bg-success-100",
          },
          {
            label: "Absent",
            value: absentCount,
            color: "text-error-500",
            bg: "bg-error-100",
          },
          {
            label: "Late",
            value: lateCount,
            color: "text-warning-500",
            bg: "bg-warning-100",
          },
          {
            label: "On Leave",
            value: onLeaveCount,
            color: "text-info-500",
            bg: "bg-info-100",
          },
        ].map((c) => (
          <div
            key={c.label}
            className="border-border-default bg-bg-surface rounded-lg border p-4 text-center"
          >
            <p className={`text-2xl font-bold ${c.color}`}>{c.value}</p>
            <p className="text-text-muted text-xs">{c.label}</p>
          </div>
        ))}
      </div>

      {/* Date Filter */}
      <div className="flex flex-wrap items-center gap-3">
        <CalendarDatePicker
          value={dateFilter}
          onChange={(val) => {
            setDateFilter(val);
            setPage(1);
          }}
          showPresets
          size="md"
        />
      </div>

      {/* Table */}
      {isLoading ? (
        <TableSkeleton />
      ) : records.length === 0 ? (
        <EmptyState
          icon={Calendar}
          title="No attendance data yet"
          description="Attendance records will appear here when your recruiters start logging in"
        />
      ) : (
        <>
          <div className="border-border-default overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-bg-muted">
                <tr>
                  <th className="text-text-secondary px-4 py-3 text-left font-medium">Employee</th>
                  <th className="text-text-secondary px-4 py-3 text-left font-medium">Role</th>
                  <th className="text-text-secondary px-4 py-3 text-left font-medium">Punch In</th>
                  <th className="text-text-secondary px-4 py-3 text-left font-medium">Punch Out</th>
                  <th className="text-text-secondary px-4 py-3 text-left font-medium">Hours</th>
                  <th className="text-text-secondary px-4 py-3 text-left font-medium">Status</th>
                  <th className="text-text-secondary px-4 py-3 text-left font-medium">Late</th>
                </tr>
              </thead>
              <tbody className="divide-border-default divide-y">
                {records.map((r) => (
                  <tr key={r.id} className="hover:bg-bg-hover">
                    <td className="px-4 py-3">
                      <p className="text-text-primary font-medium">
                        {r.user.firstName} {r.user.lastName}
                      </p>
                      <p className="text-text-muted text-xs">{r.user.employeeId}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="bg-bg-muted rounded-sm px-2 py-0.5 text-xs">
                        {r.user.role.replace("_", " ")}
                      </span>
                    </td>
                    <td className="text-text-secondary px-4 py-3">
                      {r.punchInTime
                        ? new Date(r.punchInTime).toLocaleTimeString("en-IN", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "\u2014"}
                    </td>
                    <td className="text-text-secondary px-4 py-3">
                      {r.punchOutTime
                        ? new Date(r.punchOutTime).toLocaleTimeString("en-IN", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "\u2014"}
                    </td>
                    <td className="text-text-primary px-4 py-3">
                      {r.netWorkingMinutes != null
                        ? `${Math.floor(r.netWorkingMinutes / 60)}h ${r.netWorkingMinutes % 60}m`
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
                                  : "bg-bg-muted text-text-muted",
                        )}
                      >
                        {r.status.replace("_", " ")}
                      </span>
                    </td>
                    <td className="text-text-muted px-4 py-3">
                      {r.isLate && r.lateByMinutes ? `${r.lateByMinutes}m` : "\u2014"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {data && data.pagination.totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-text-muted text-xs">
                Showing {(page - 1) * DEFAULT_LARGE_PAGE_SIZE + 1}\u2013
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
        </>
      )}
    </div>
  );
}
