"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Check,
  X,
  CheckCheck,
  Eye,
  Download,
  FileCheck,
  Clock as ClockIcon,
  XCircle,
  FileText,
} from "lucide-react";
import { Card, Checkbox } from "@/components/ui";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { exportToXLSX } from "@/utils/export-table";
import { viewDocument } from "@/services/document.service";
import { SearchInput } from "@/components/ui/search-input";
import { TableSkeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { PaginatedResponse } from "@/types/api";

// ──────────────────────────────────────────────
//  Admin Document Verification — Spec Section 29.5
// ──────────────────────────────────────────────

interface EmployeeDoc {
  id: string;
  fileUrl: string | null;
  fileName: string | null;
  status: string;
  uploadedAt: string | null;
  user: { firstName: string; lastName: string; employeeId: string | null };
  documentType: { name: string; code: string };
}

export default function AdminDocumentsPage() {
  const [data, setData] = useState<PaginatedResponse<EmployeeDoc> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("PENDING");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [rejectTarget, setRejectTarget] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const params: Record<string, string> = { page: String(page), limit: "25" };
      if (statusFilter) params["status"] = statusFilter;
      if (search) params["search"] = search;
      const res = await api.get<PaginatedResponse<EmployeeDoc>>("/documents", { params });
      setData(res.data);
      setSelectedIds(new Set());
    } finally {
      setIsLoading(false);
    }
  }, [page, statusFilter, search]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const handleVerify = async (id: string) => {
    try {
      await api.patch(`/documents/${id}/verify`);
      toast.success("Document verified");
      void fetchData();
    } catch {
      toast.error("Failed to verify");
    }
  };

  const handleReject = async () => {
    if (!rejectTarget || !rejectReason) return;
    try {
      await api.patch(`/documents/${rejectTarget}/reject`, { reason: rejectReason });
      toast.success("Document rejected");
      setRejectTarget(null);
      setRejectReason("");
      void fetchData();
    } catch {
      toast.error("Failed to reject");
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
    const allIds = (data?.data ?? []).map((d) => d.id);
    if (selectedIds.size === allIds.length && allIds.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(allIds));
    }
  };

  const handleBatchVerify = async () => {
    if (selectedIds.size === 0) return;
    setIsBatchProcessing(true);
    let success = 0;
    for (const id of selectedIds) {
      try {
        await api.patch(`/documents/${id}/verify`);
        success++;
      } catch {
        /* skip */
      }
    }
    toast.success(`${success} document(s) verified`);
    setIsBatchProcessing(false);
    void fetchData();
  };

  const handleBatchReject = async () => {
    if (selectedIds.size === 0) return;
    setIsBatchProcessing(true);
    let success = 0;
    for (const id of selectedIds) {
      try {
        await api.patch(`/documents/${id}/reject`, { reason: "Batch rejected by admin" });
        success++;
      } catch {
        /* skip */
      }
    }
    toast.success(`${success} document(s) rejected`);
    setIsBatchProcessing(false);
    void fetchData();
  };

  const pendingCount = (data?.data ?? []).filter((d) => d.status === "PENDING").length;

  const stats = useMemo(() => {
    const items = data?.data ?? [];
    const total = data?.pagination?.total ?? items.length;
    const verified = items.filter((d) => d.status === "VERIFIED").length;
    const rejected = items.filter((d) => d.status === "REJECTED").length;
    const pending = items.filter((d) => d.status === "PENDING").length;
    return { total, verified, rejected, pending };
  }, [data]);

  const docs = data?.data ?? [];

  const handleExport = () => {
    exportToXLSX(
      docs,
      [
        { header: "Employee Name", accessor: (d) => `${d.user.firstName} ${d.user.lastName}` },
        { header: "Document Type", accessor: (d) => d.documentType.name },
        { header: "File Name", accessor: (d) => d.fileName ?? "\u2014" },
        { header: "Status", accessor: (d) => d.status },
        {
          header: "Uploaded At",
          accessor: (d) =>
            d.uploadedAt ? new Date(d.uploadedAt).toLocaleDateString("en-IN") : "\u2014",
        },
      ],
      "documents",
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-text-primary text-2xl font-bold">Document Verification</h1>
          <button
            onClick={handleExport}
            className="bg-primary-500 hover:bg-primary-600 flex items-center gap-2 rounded-md px-4 py-2 text-sm text-white"
          >
            <Download size={14} /> Export XLSX
          </button>
        </div>
        {pendingCount > 0 && (
          <span className="bg-warning-100 text-warning-700 rounded-full px-3 py-1 text-sm font-medium">
            {pendingCount} pending
          </span>
        )}
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card padding="sm">
          <div className="flex items-center gap-3">
            <div className="bg-primary-100 flex h-10 w-10 items-center justify-center rounded-lg">
              <FileText size={18} className="text-primary-600" />
            </div>
            <div>
              <p className="text-text-muted text-xs">Total</p>
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
              <FileCheck size={18} className="text-success-600" />
            </div>
            <div>
              <p className="text-text-muted text-xs">Verified</p>
              <p className="text-success-600 text-xl font-bold">{stats.verified}</p>
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

      {/* Search */}
      <SearchInput
        value={search}
        onChange={(v) => {
          setSearch(v);
          setPage(1);
        }}
        placeholder="Search by employee name or document..."
        historyKey="documents"
        className="max-w-sm"
      />

      {/* Filter Tabs + Batch Actions */}
      <div className="flex items-center justify-between">
        <div className="border-border-default bg-bg-muted flex w-fit gap-1 rounded-lg border p-1">
          {["PENDING", "VERIFIED", "REJECTED", ""].map((s) => (
            <button
              key={s}
              onClick={() => {
                setStatusFilter(s);
                setPage(1);
              }}
              className={cn(
                "rounded-md px-4 py-1.5 text-sm font-medium",
                statusFilter === s
                  ? "bg-bg-surface text-text-primary shadow-xs"
                  : "text-text-muted",
              )}
            >
              {s || "All"}
            </button>
          ))}
        </div>

        {selectedIds.size > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-text-secondary text-sm">{selectedIds.size} selected</span>
            <button
              onClick={() => void handleBatchVerify()}
              disabled={isBatchProcessing}
              className="bg-success-500 flex items-center gap-1 rounded-md px-3 py-1.5 text-sm text-white disabled:opacity-50"
            >
              <CheckCheck size={14} /> Verify All
            </button>
            <button
              onClick={() => void handleBatchReject()}
              disabled={isBatchProcessing}
              className="bg-error-500 flex items-center gap-1 rounded-md px-3 py-1.5 text-sm text-white disabled:opacity-50"
            >
              <X size={14} /> Reject All
            </button>
          </div>
        )}
      </div>

      {isLoading ? (
        <TableSkeleton />
      ) : (
        <div className="border-border-default overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-bg-muted">
              <tr>
                <th className="w-10 px-4 py-3">
                  <Checkbox
                    checked={selectedIds.size > 0 && selectedIds.size === (data?.data ?? []).length}
                    onChange={toggleSelectAll}
                  />
                </th>
                <th className="text-text-secondary px-4 py-3 text-left font-medium">Employee</th>
                <th className="text-text-secondary px-4 py-3 text-left font-medium">Document</th>
                <th className="text-text-secondary px-4 py-3 text-left font-medium">File</th>
                <th className="text-text-secondary px-4 py-3 text-left font-medium">Status</th>
                <th className="text-text-secondary px-4 py-3 text-left font-medium">Uploaded</th>
                <th className="text-text-secondary px-4 py-3 text-left font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-border-default divide-y">
              {data?.data.map((d) => (
                <tr key={d.id} className="hover:bg-bg-hover">
                  <td className="px-4 py-3">
                    <Checkbox checked={selectedIds.has(d.id)} onChange={() => toggleSelect(d.id)} />
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-text-primary font-medium">
                      {d.user.firstName} {d.user.lastName}
                    </p>
                    <p className="text-text-muted text-xs">{d.user.employeeId}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="bg-bg-muted rounded-sm px-2 py-0.5 text-xs">
                      {d.documentType.name}
                    </span>
                  </td>
                  <td className="text-text-secondary px-4 py-3 text-xs">
                    {d.fileName ?? "\u2014"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-xs font-medium",
                        d.status === "VERIFIED"
                          ? "bg-success-100 text-success-700"
                          : d.status === "REJECTED"
                            ? "bg-error-100 text-error-700"
                            : "bg-warning-100 text-warning-700",
                      )}
                    >
                      {d.status}
                    </span>
                  </td>
                  <td className="text-text-muted px-4 py-3 text-xs">
                    {d.uploadedAt ? new Date(d.uploadedAt).toLocaleDateString("en-IN") : "\u2014"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      {d.fileUrl && (
                        <button
                          onClick={() =>
                            void viewDocument(d.id).then((url) => window.open(url, "_blank"))
                          }
                          title="View Document"
                          className="text-primary-500 hover:bg-primary-100 rounded-sm p-1.5"
                        >
                          <Eye size={14} />
                        </button>
                      )}
                      {d.status !== "VERIFIED" && (
                        <button
                          onClick={() => void handleVerify(d.id)}
                          title="Verify"
                          className="text-success-500 hover:bg-success-100 rounded-sm p-1.5"
                        >
                          <Check size={14} />
                        </button>
                      )}
                      {d.status !== "REJECTED" && (
                        <button
                          onClick={() => setRejectTarget(d.id)}
                          title="Reject"
                          className="text-error-500 hover:bg-error-100 rounded-sm p-1.5"
                        >
                          <X size={14} />
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

      {/* Reject Reason Modal */}
      {rejectTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="bg-bg-overlay absolute inset-0" onClick={() => setRejectTarget(null)} />
          <div className="border-border-default bg-bg-surface-raised relative z-10 w-full max-w-sm rounded-lg border p-6 shadow-xl">
            <h3 className="text-text-primary font-semibold">Rejection Reason</h3>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Enter reason..."
              rows={3}
              className="border-border-default bg-bg-input mt-3 w-full rounded-md border px-3 py-2 text-sm"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setRejectTarget(null)}
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
    </div>
  );
}
