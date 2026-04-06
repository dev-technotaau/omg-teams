"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Check,
  X,
  CheckCheck,
  RotateCcw,
  Wallet,
  Download,
  Clock as ClockIcon,
  FileText,
  XCircle,
  CheckCircle,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { exportToXLSX } from "@/utils/export-table";
import { Card, Checkbox, Select } from "@/components/ui";
import { SearchInput } from "@/components/ui/search-input";
import { TableSkeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { DEFAULT_LARGE_PAGE_SIZE } from "@/constants/pagination";
import type { LeaveRequest, LeaveBalance, LeaveType } from "@/types/leave";
import type { PaginatedResponse } from "@/types/api";

// ──────────────────────────────────────────────
//  Admin Leave Management — Spec Section 28.3
// ──────────────────────────────────────────────

type AdminTab = "requests" | "balances";

export default function AdminLeavesPage() {
  const [activeTab, setActiveTab] = useState<AdminTab>("requests");
  const [data, setData] = useState<PaginatedResponse<LeaveRequest> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("PENDING");
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [leaveTypeFilter, setLeaveTypeFilter] = useState("");
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [page, setPage] = useState(1);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [revokeId, setRevokeId] = useState<string | null>(null);
  const [revokeReason, setRevokeReason] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);

  // Balance tab state
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [balancesLoading, setBalancesLoading] = useState(false);
  const [balanceYear, setBalanceYear] = useState(new Date().getFullYear());
  // §28.3.3 — Balance adjustment modal
  const [adjustTarget, setAdjustTarget] = useState<{
    userId: string;
    userName: string;
    leaveTypeId: string;
    leaveTypeName: string;
  } | null>(null);
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustReason, setAdjustReason] = useState("");

  // Load leave types
  useEffect(() => {
    api
      .get<{ types: LeaveType[] }>("/leaves/types")
      .then((r) => setLeaveTypes(r.data.types))
      .catch(() => {});
  }, []);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const params: Record<string, string> = {
        page: String(page),
        limit: String(DEFAULT_LARGE_PAGE_SIZE),
      };
      if (statusFilter) params["status"] = statusFilter;
      const res = await api.get<PaginatedResponse<LeaveRequest>>("/leaves", { params });
      setData(res.data);
      setSelectedIds(new Set());
    } finally {
      setIsLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => {
    if (activeTab === "requests") void fetchData();
  }, [fetchData, activeTab]);

  const fetchBalances = useCallback(async () => {
    setBalancesLoading(true);
    try {
      const res = await api.get<{ balances: LeaveBalance[] }>("/leaves/balances/all", {
        params: { year: String(balanceYear) },
      });
      setBalances(res.data.balances);
    } catch {
      toast.error("Failed to load balances");
    } finally {
      setBalancesLoading(false);
    }
  }, [balanceYear]);

  useEffect(() => {
    if (activeTab === "balances") void fetchBalances();
  }, [fetchBalances, activeTab]);

  const handleApprove = async (id: string) => {
    try {
      await api.patch(`/leaves/${id}/approve`);
      toast.success("Leave approved");
      void fetchData();
    } catch {
      toast.error("Failed to approve");
    }
  };

  const handleReject = async () => {
    if (!rejectId || !rejectReason) return;
    try {
      await api.patch(`/leaves/${rejectId}/reject`, { reason: rejectReason });
      toast.success("Leave rejected");
      setRejectId(null);
      setRejectReason("");
      void fetchData();
    } catch {
      toast.error("Failed to reject");
    }
  };

  const handleRevoke = async () => {
    if (!revokeId || !revokeReason) return;
    try {
      await api.patch(`/leaves/${revokeId}/revoke`, { reason: revokeReason });
      toast.success("Leave revoked — balance restored");
      setRevokeId(null);
      setRevokeReason("");
      void fetchData();
    } catch {
      toast.error("Failed to revoke");
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    const pendingIds = (data?.data ?? []).filter((r) => r.status === "PENDING").map((r) => r.id);
    if (selectedIds.size === pendingIds.length && pendingIds.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(pendingIds));
    }
  };

  const handleBulkApprove = async () => {
    if (selectedIds.size === 0) return;
    setIsBulkProcessing(true);
    let success = 0;
    for (const id of selectedIds) {
      try {
        await api.patch(`/leaves/${id}/approve`);
        success++;
      } catch {
        /* skip */
      }
    }
    toast.success(`${success} leave request(s) approved`);
    setIsBulkProcessing(false);
    void fetchData();
  };

  const handleBulkReject = async () => {
    if (selectedIds.size === 0) return;
    setIsBulkProcessing(true);
    let success = 0;
    for (const id of selectedIds) {
      try {
        await api.patch(`/leaves/${id}/reject`, { reason: "Bulk rejected by admin" });
        success++;
      } catch {
        /* skip */
      }
    }
    toast.success(`${success} leave request(s) rejected`);
    setIsBulkProcessing(false);
    void fetchData();
  };

  const requests = data?.data ?? [];

  // Client-side filters for employee search and leave type
  const filteredRequests = requests.filter((r) => {
    if (employeeSearch) {
      const q = employeeSearch.toLowerCase();
      if (
        !`${r.user.firstName} ${r.user.lastName} ${r.user.employeeId ?? ""}`
          .toLowerCase()
          .includes(q)
      )
        return false;
    }
    if (leaveTypeFilter && r.leaveType.code !== leaveTypeFilter) return false;
    return true;
  });

  const pendingCount = requests.filter((r) => r.status === "PENDING").length;

  const stats = useMemo(() => {
    const reqs = data?.data ?? [];
    const total = data?.pagination?.total ?? reqs.length;
    const approved = reqs.filter((r) => r.status === "APPROVED").length;
    const rejected = reqs.filter((r) => r.status === "REJECTED").length;
    return { total, pending: pendingCount, approved, rejected };
  }, [data, pendingCount]);

  const handleExport = () => {
    exportToXLSX(
      filteredRequests,
      [
        { header: "Employee Name", accessor: (r) => `${r.user.firstName} ${r.user.lastName}` },
        { header: "Leave Type", accessor: (r) => r.leaveType.code },
        {
          header: "Start Date",
          accessor: (r) => new Date(r.startDate).toLocaleDateString("en-IN"),
        },
        { header: "End Date", accessor: (r) => new Date(r.endDate).toLocaleDateString("en-IN") },
        { header: "Days", accessor: (r) => r.numberOfDays },
        { header: "Status", accessor: (r) => r.status },
        { header: "Reason", accessor: (r) => r.reason },
      ],
      "leaves",
    );
  };

  // §28.3.3 — Handle balance adjustment
  const handleAdjust = async () => {
    if (!adjustTarget || !adjustAmount || !adjustReason) {
      toast.error("Amount and reason are required");
      return;
    }
    try {
      await api.post("/leaves/balances/adjust", {
        userId: adjustTarget.userId,
        leaveTypeId: adjustTarget.leaveTypeId,
        amount: parseFloat(adjustAmount),
        reason: adjustReason,
        year: balanceYear,
      });
      toast.success("Balance adjusted");
      setAdjustTarget(null);
      setAdjustAmount("");
      setAdjustReason("");
      void fetchBalances();
    } catch {
      toast.error("Failed to adjust balance");
    }
  };

  // Group balances by employee for the balance tab
  const balancesByEmployee = balances.reduce<
    Record<string, { user: LeaveBalance["user"]; entries: LeaveBalance[] }>
  >((acc, b) => {
    const key = b.user.employeeId ?? b.user.firstName;
    if (!acc[key]) acc[key] = { user: b.user, entries: [] };
    acc[key]!.entries.push(b);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-text-primary text-2xl font-bold">Leave Management</h1>
          <button
            onClick={handleExport}
            className="bg-primary-500 hover:bg-primary-600 flex items-center gap-2 rounded-md px-4 py-2 text-sm text-white"
          >
            <Download size={14} /> Export XLSX
          </button>
        </div>
        {/* Main Tabs: Requests vs Balances */}
        <div className="border-border-default bg-bg-muted flex gap-1 rounded-lg border p-1">
          <button
            onClick={() => setActiveTab("requests")}
            className={cn(
              "rounded-md px-4 py-1.5 text-sm font-medium",
              activeTab === "requests" ? "bg-bg-surface shadow-xs" : "text-text-muted",
            )}
          >
            Requests
          </button>
          <button
            onClick={() => setActiveTab("balances")}
            className={cn(
              "flex items-center gap-1 rounded-md px-4 py-1.5 text-sm font-medium",
              activeTab === "balances" ? "bg-bg-surface shadow-xs" : "text-text-muted",
            )}
          >
            <Wallet size={14} /> Balances
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      {activeTab === "requests" && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Card padding="sm">
            <div className="flex items-center gap-3">
              <div className="bg-primary-100 flex h-10 w-10 items-center justify-center rounded-lg">
                <FileText size={18} className="text-primary-600" />
              </div>
              <div>
                <p className="text-text-muted text-xs">Total Requests</p>
                <p className="text-text-primary text-xl font-bold">{stats.total}</p>
              </div>
            </div>
          </Card>
          <Card padding="sm">
            <div className="flex items-center gap-3">
              <div className="bg-warning-100 flex h-10 w-10 items-center justify-center rounded-lg">
                <ClockIcon size={18} className="text-warning-600" />
              </div>
              <div>
                <p className="text-text-muted text-xs">Pending</p>
                <p className="text-warning-600 text-xl font-bold">{stats.pending}</p>
              </div>
            </div>
          </Card>
          <Card padding="sm">
            <div className="flex items-center gap-3">
              <div className="bg-success-100 flex h-10 w-10 items-center justify-center rounded-lg">
                <CheckCircle size={18} className="text-success-600" />
              </div>
              <div>
                <p className="text-text-muted text-xs">Approved</p>
                <p className="text-success-600 text-xl font-bold">{stats.approved}</p>
              </div>
            </div>
          </Card>
          <Card padding="sm">
            <div className="flex items-center gap-3">
              <div className="bg-error-100 flex h-10 w-10 items-center justify-center rounded-lg">
                <XCircle size={18} className="text-error-600" />
              </div>
              <div>
                <p className="text-text-muted text-xs">Rejected</p>
                <p className="text-error-600 text-xl font-bold">{stats.rejected}</p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {activeTab === "requests" && (
        <>
          {/* Status Filter Tabs + Filters */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="border-border-default bg-bg-muted flex w-fit gap-1 rounded-lg border p-1">
              {[
                { value: "PENDING", label: "Pending", count: pendingCount },
                { value: "APPROVED", label: "Approved" },
                { value: "REJECTED", label: "Rejected" },
                { value: "", label: "All" },
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
                  {s.count != null && s.count > 0 && (
                    <span className="bg-warning-500 ml-1 inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] text-white">
                      {s.count}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {selectedIds.size > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-text-secondary text-sm">{selectedIds.size} selected</span>
                <button
                  onClick={() => void handleBulkApprove()}
                  disabled={isBulkProcessing}
                  className="bg-success-500 flex items-center gap-1 rounded-md px-3 py-1.5 text-sm text-white disabled:opacity-50"
                >
                  <CheckCheck size={14} /> Approve All
                </button>
                <button
                  onClick={() => void handleBulkReject()}
                  disabled={isBulkProcessing}
                  className="bg-error-500 flex items-center gap-1 rounded-md px-3 py-1.5 text-sm text-white disabled:opacity-50"
                >
                  <X size={14} /> Reject All
                </button>
              </div>
            )}
          </div>

          {/* Additional Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <SearchInput
              value={employeeSearch}
              onChange={setEmployeeSearch}
              placeholder="Search employee..."
              historyKey="leaves"
              className="max-w-xs flex-1"
            />
            <Select
              value={leaveTypeFilter}
              onChange={(e) => setLeaveTypeFilter(e.target.value)}
              options={[
                { value: "", label: "All Types" },
                ...leaveTypes.map((t) => ({ value: t.code, label: t.name })),
              ]}
              className="w-48"
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
                    {statusFilter === "PENDING" && (
                      <th className="w-10 px-4 py-3">
                        <Checkbox
                          checked={selectedIds.size > 0 && selectedIds.size === pendingCount}
                          onChange={toggleSelectAll}
                        />
                      </th>
                    )}
                    <th className="text-text-secondary px-4 py-3 text-left font-medium">
                      Employee
                    </th>
                    <th className="text-text-secondary px-4 py-3 text-left font-medium">Type</th>
                    <th className="text-text-secondary px-4 py-3 text-left font-medium">Dates</th>
                    <th className="text-text-secondary px-4 py-3 text-left font-medium">Days</th>
                    <th className="text-text-secondary px-4 py-3 text-left font-medium">Reason</th>
                    <th className="text-text-secondary px-4 py-3 text-left font-medium">Status</th>
                    <th className="text-text-secondary px-4 py-3 text-left font-medium">
                      Requested
                    </th>
                    <th className="text-text-secondary px-4 py-3 text-left font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-border-default divide-y">
                  {filteredRequests.map((r) => (
                    <tr key={r.id} className="hover:bg-bg-hover">
                      {statusFilter === "PENDING" && (
                        <td className="px-4 py-3">
                          {r.status === "PENDING" && (
                            <Checkbox
                              checked={selectedIds.has(r.id)}
                              onChange={() => toggleSelect(r.id)}
                            />
                          )}
                        </td>
                      )}
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
                                : r.status === "REVOKED"
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
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          {r.status === "PENDING" && (
                            <>
                              <button
                                onClick={() => void handleApprove(r.id)}
                                title="Approve"
                                className="text-success-500 hover:bg-success-100 rounded-sm p-1.5"
                              >
                                <Check size={14} />
                              </button>
                              <button
                                onClick={() => setRejectId(r.id)}
                                title="Reject"
                                className="text-error-500 hover:bg-error-100 rounded-sm p-1.5"
                              >
                                <X size={14} />
                              </button>
                            </>
                          )}
                          {r.status === "APPROVED" && (
                            <button
                              onClick={() => setRevokeId(r.id)}
                              title="Revoke"
                              className="text-warning-700 hover:bg-warning-100 rounded-sm p-1.5"
                            >
                              <RotateCcw size={14} />
                            </button>
                          )}
                        </div>
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
                Page {page} of {data.pagination.totalPages}
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

      {/* Balances Tab */}
      {activeTab === "balances" && (
        <>
          <div className="flex items-center gap-3">
            <Select
              value={String(balanceYear)}
              onChange={(e) => setBalanceYear(Number(e.target.value))}
              options={[2024, 2025, 2026, 2027].map((y) => ({
                value: String(y),
                label: String(y),
              }))}
              className="w-28"
            />
          </div>

          {balancesLoading ? (
            <TableSkeleton />
          ) : (
            <div className="border-border-default overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-bg-muted">
                  <tr>
                    <th className="text-text-secondary px-4 py-3 text-left font-medium">
                      Employee
                    </th>
                    <th className="text-text-secondary px-4 py-3 text-left font-medium">Role</th>
                    {leaveTypes.map((t) => (
                      <th
                        key={t.id}
                        className="text-text-secondary px-4 py-3 text-center font-medium"
                      >
                        {t.code}
                      </th>
                    ))}
                    <th className="text-text-secondary px-4 py-3 text-center font-medium">
                      Total Used
                    </th>
                    <th className="text-text-secondary px-4 py-3 text-center font-medium">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-border-default divide-y">
                  {Object.values(balancesByEmployee).map((emp) => {
                    const totalUsed = emp.entries.reduce((s, e) => s + e.used, 0);
                    return (
                      <tr key={emp.user.employeeId} className="hover:bg-bg-hover">
                        <td className="px-4 py-3">
                          <p className="text-text-primary font-medium">
                            {emp.user.firstName} {emp.user.lastName}
                          </p>
                          <p className="text-text-muted text-xs">{emp.user.employeeId}</p>
                        </td>
                        <td className="px-4 py-3 text-xs">{emp.user.role.replace(/_/g, " ")}</td>
                        {leaveTypes.map((t) => {
                          const entry = emp.entries.find((e) => e.leaveType.code === t.code);
                          if (!entry)
                            return (
                              <td
                                key={t.id}
                                className="text-text-muted px-4 py-3 text-center text-xs"
                              >
                                {"\u2014"}
                              </td>
                            );
                          return (
                            <td key={t.id} className="px-4 py-3 text-center">
                              <span className="text-text-primary text-xs">
                                {entry.totalAllotted}
                              </span>
                              <span className="text-text-muted text-xs"> / </span>
                              <span className="text-success-500 text-xs">{entry.used}</span>
                              <span className="text-text-muted text-xs"> / </span>
                              <span
                                className={cn(
                                  "text-xs font-medium",
                                  entry.remaining <= 0 ? "text-error-500" : "text-text-primary",
                                )}
                              >
                                {entry.remaining}
                              </span>
                            </td>
                          );
                        })}
                        <td className="text-text-primary px-4 py-3 text-center font-medium">
                          {totalUsed}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Select
                            size="sm"
                            value=""
                            placeholder="Adjust..."
                            onChange={(e) => {
                              const leaveTypeId = e.target.value;
                              if (!leaveTypeId) return;
                              const lt = leaveTypes.find((t) => t.id === leaveTypeId);
                              setAdjustTarget({
                                userId: emp.entries[0]?.userId ?? "",
                                userName: `${emp.user.firstName} ${emp.user.lastName}`,
                                leaveTypeId,
                                leaveTypeName: lt?.name ?? "",
                              });
                            }}
                            options={leaveTypes.map((t) => ({ value: t.id, label: t.code }))}
                            className="w-28"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {Object.keys(balancesByEmployee).length === 0 && (
                <div className="text-text-muted p-8 text-center text-sm">
                  No balance records found for {balanceYear}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Reject Reason Modal */}
      {rejectId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="bg-bg-overlay absolute inset-0" onClick={() => setRejectId(null)} />
          <div className="border-border-default bg-bg-surface-raised relative z-10 w-full max-w-sm rounded-lg border p-6 shadow-xl">
            <h3 className="text-text-primary font-semibold">Rejection Reason</h3>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Enter reason for rejection..."
              rows={3}
              className="border-border-default bg-bg-input mt-3 w-full rounded-md border px-3 py-2 text-sm"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setRejectId(null)}
                className="border-border-default rounded-md border px-4 py-2 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleReject()}
                disabled={!rejectReason}
                className="bg-error-500 rounded-md px-4 py-2 text-sm text-white disabled:opacity-50"
              >
                Reject
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Revoke Reason Modal */}
      {revokeId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="bg-bg-overlay absolute inset-0" onClick={() => setRevokeId(null)} />
          <div className="border-border-default bg-bg-surface-raised relative z-10 w-full max-w-sm rounded-lg border p-6 shadow-xl">
            <h3 className="text-text-primary font-semibold">Revocation Reason</h3>
            <p className="text-text-muted mt-1 text-xs">
              This will restore the leave balance and revert attendance records.
            </p>
            <textarea
              value={revokeReason}
              onChange={(e) => setRevokeReason(e.target.value)}
              placeholder="Enter reason for revocation..."
              rows={3}
              className="border-border-default bg-bg-input mt-3 w-full rounded-md border px-3 py-2 text-sm"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setRevokeId(null)}
                className="border-border-default rounded-md border px-4 py-2 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleRevoke()}
                disabled={!revokeReason}
                className="bg-warning-500 rounded-md px-4 py-2 text-sm text-white disabled:opacity-50"
              >
                Revoke
              </button>
            </div>
          </div>
        </div>
      )}
      {/* §28.3.3 — Balance Adjustment Modal */}
      {adjustTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-bg-surface w-full max-w-md rounded-lg p-6 shadow-xl">
            <h3 className="text-text-primary mb-4 text-lg font-semibold">Adjust Leave Balance</h3>
            <p className="text-text-secondary mb-4 text-sm">
              {adjustTarget.userName} &mdash; {adjustTarget.leaveTypeName}
            </p>
            <div className="space-y-3">
              <div>
                <label className="text-text-secondary mb-1 block text-sm font-medium">
                  Amount (positive to credit, negative to debit)
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={adjustAmount}
                  onChange={(e) => setAdjustAmount(e.target.value)}
                  className="border-border-default bg-bg-input w-full rounded-md border px-3 py-2 text-sm"
                  placeholder="e.g. 2 or -1"
                />
              </div>
              <div>
                <label className="text-text-secondary mb-1 block text-sm font-medium">
                  Reason (required)
                </label>
                <textarea
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  className="border-border-default bg-bg-input w-full rounded-md border px-3 py-2 text-sm"
                  rows={2}
                  placeholder="Reason for adjustment"
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setAdjustTarget(null)}
                className="border-border-default text-text-primary rounded-md border px-4 py-2 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleAdjust()}
                className="bg-primary-500 rounded-md px-4 py-2 text-sm font-medium text-white"
              >
                Adjust
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
