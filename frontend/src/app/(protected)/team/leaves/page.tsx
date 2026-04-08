"use client";

import { useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { qk } from "@/lib/query-keys";
import { CalendarDays } from "lucide-react";
import { api } from "@/lib/api";
import { TableSkeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import { DEFAULT_LARGE_PAGE_SIZE } from "@/constants/pagination";
import type { LeaveRequest } from "@/types/leave";
import type { PaginatedResponse } from "@/types/api";

// ──────────────────────────────────────────────
//  Team Leave View — Spec Section 28.5
//  Read-only view for Reporting Managers
// ──────────────────────────────────────────────

export default function TeamLeavesPage() {
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);

  const teamQuery = useQuery({
    queryKey: qk.leaves.list({ scope: "team", page, statusFilter }),
    queryFn: async () => {
      const params: Record<string, string> = {
        page: String(page),
        limit: String(DEFAULT_LARGE_PAGE_SIZE),
      };
      if (statusFilter) params["status"] = statusFilter;
      const res = await api.get<PaginatedResponse<LeaveRequest>>("/leaves/team", { params });
      return res.data;
    },
    placeholderData: keepPreviousData,
  });
  const data = teamQuery.data ?? null;
  const isLoading = teamQuery.isLoading;

  const requests = data?.data ?? [];
  const pendingCount = requests.filter((r) => r.status === "PENDING").length;
  const approvedCount = requests.filter((r) => r.status === "APPROVED").length;
  const rejectedCount = requests.filter((r) => r.status === "REJECTED").length;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-text-primary text-2xl font-bold">Team Leaves</h1>
        <p className="text-text-secondary mt-1 text-sm">
          View leave requests from your assigned recruiters (read-only — only Admin can
          approve/reject)
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          { label: "Pending", value: pendingCount, color: "text-warning-500" },
          { label: "Approved", value: approvedCount, color: "text-success-500" },
          { label: "Rejected", value: rejectedCount, color: "text-error-500" },
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

      {/* Status Filter Tabs */}
      <div className="border-border-default bg-bg-muted flex w-fit gap-1 rounded-lg border p-1">
        {[
          { value: "", label: "All" },
          { value: "PENDING", label: "Pending" },
          { value: "APPROVED", label: "Approved" },
          { value: "REJECTED", label: "Rejected" },
        ].map((s) => (
          <button
            key={s.value}
            onClick={() => {
              setStatusFilter(s.value);
              setPage(1);
            }}
            className={cn(
              "rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
              statusFilter === s.value
                ? "bg-bg-surface text-text-primary shadow-xs"
                : "text-text-muted",
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Table */}
      {isLoading ? (
        <TableSkeleton />
      ) : requests.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="No leave requests"
          description="Leave requests from your assigned recruiters will appear here"
        />
      ) : (
        <>
          <div className="border-border-default overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-bg-muted">
                <tr>
                  <th className="text-text-secondary px-4 py-3 text-left font-medium">Employee</th>
                  <th className="text-text-secondary px-4 py-3 text-left font-medium">Type</th>
                  <th className="text-text-secondary px-4 py-3 text-left font-medium">Dates</th>
                  <th className="text-text-secondary px-4 py-3 text-left font-medium">Days</th>
                  <th className="text-text-secondary px-4 py-3 text-left font-medium">Reason</th>
                  <th className="text-text-secondary px-4 py-3 text-left font-medium">Status</th>
                  <th className="text-text-secondary px-4 py-3 text-left font-medium">Requested</th>
                </tr>
              </thead>
              <tbody className="divide-border-default divide-y">
                {requests.map((r) => (
                  <tr key={r.id} className="hover:bg-bg-hover">
                    <td className="px-4 py-3">
                      <p className="text-text-primary font-medium">
                        {r.user.firstName} {r.user.lastName}
                      </p>
                      <p className="text-text-muted text-xs">{r.user.employeeId}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="bg-bg-muted rounded-sm px-2 py-0.5 text-xs">
                        {r.leaveType.code}
                      </span>
                    </td>
                    <td className="text-text-secondary px-4 py-3 text-xs">
                      {new Date(r.startDate).toLocaleDateString("en-IN")} —{" "}
                      {new Date(r.endDate).toLocaleDateString("en-IN")}
                    </td>
                    <td className="px-4 py-3">{r.numberOfDays}</td>
                    <td className="text-text-secondary max-w-xs truncate px-4 py-3 text-xs">
                      {r.reason}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-xs font-medium",
                          r.status === "APPROVED"
                            ? "bg-success-100 text-success-700"
                            : r.status === "REJECTED"
                              ? "bg-error-100 text-error-700"
                              : r.status === "CANCELLED"
                                ? "bg-bg-muted text-text-muted"
                                : "bg-warning-100 text-warning-700",
                        )}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="text-text-muted px-4 py-3 text-xs">
                      {new Date(r.createdAt).toLocaleDateString("en-IN")}
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
                Showing {(page - 1) * DEFAULT_LARGE_PAGE_SIZE + 1}–
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
