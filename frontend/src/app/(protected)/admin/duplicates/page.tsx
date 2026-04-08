"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { qk } from "@/lib/query-keys";
import {
  ChevronDown,
  ChevronRight,
  CheckCircle,
  XCircle,
  Copy,
  GitMerge,
  Users,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { mergeDuplicates } from "@/services/duplicate.service";
import {
  PageHeader,
  Tabs,
  Badge,
  Button,
  Card,
  IconButton,
  Tooltip,
  SearchInput,
} from "@/components/ui";
import { cn } from "@/lib/utils";
import { TableSkeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { useTabSearchParam } from "@/hooks";

const DUPLICATE_STATUS_IDS = ["PENDING", "RESOLVED", "DISMISSED", ""] as const;
type DuplicateStatusId = (typeof DUPLICATE_STATUS_IDS)[number];

// ──────────────────────────────────────────────
//  Admin Duplicate Management — Spec Section 23.3
// ──────────────────────────────────────────────

interface CandidateReport {
  candidateName: string;
  contactNo: string;
  emailId: string;
  recruiter: { firstName: string; lastName: string } | null;
  company: { name: string } | null;
  dateSourced?: string;
  zone?: string;
}

interface DuplicateMember {
  candidateReportId: string;
  candidateReport: CandidateReport;
}

interface DuplicateGroup {
  id: string;
  detectedAt: string;
  status: "PENDING" | "RESOLVED" | "DISMISSED";
  members: DuplicateMember[];
}

interface PaginatedResponse {
  data: DuplicateGroup[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

const STATUS_TABS = [
  { id: "PENDING", label: "Pending" },
  { id: "RESOLVED", label: "Resolved" },
  { id: "DISMISSED", label: "Dismissed" },
  { id: "", label: "All" },
];

const STATUS_BADGE_VARIANT: Record<string, "warning" | "success" | "default"> = {
  PENDING: "warning",
  RESOLVED: "success",
  DISMISSED: "default",
};

export default function AdminDuplicatesPage() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useTabSearchParam<DuplicateStatusId>(
    "status",
    "PENDING",
    DUPLICATE_STATUS_IDS,
  );
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [pendingCount, setPendingCount] = useState(0);
  const [merging, setMerging] = useState(false);

  const dupQuery = useQuery({
    queryKey: qk.duplicates.list({ page, statusFilter, search }),
    queryFn: async () => {
      const params: Record<string, string> = { page: String(page), limit: "20" };
      if (statusFilter) params.status = statusFilter;
      if (search) params.search = search;
      const res = await api.get<PaginatedResponse>("/duplicates", { params });
      return res.data;
    },
    placeholderData: keepPreviousData,
  });
  const data = dupQuery.data ?? null;
  const isLoading = dupQuery.isLoading;
  const fetchData = useCallback(
    () => qc.invalidateQueries({ queryKey: qk.duplicates.lists() }),
    [qc],
  );

  // Fetch pending count for badge
  useEffect(() => {
    api
      .get<PaginatedResponse>("/duplicates", { params: { status: "PENDING", limit: "1" } })
      .then((r) => setPendingCount(r.data.pagination.total))
      .catch(() => {});
  }, [data]);

  const stats = useMemo(() => {
    const groups = data?.data ?? [];
    const total = data?.pagination?.total ?? groups.length;
    const totalMembers = groups.reduce((s, g) => s + g.members.length, 0);
    const pending = groups.filter((g) => g.status === "PENDING").length;
    const resolved = groups.filter((g) => g.status === "RESOLVED").length;
    return { total, totalMembers, pending, resolved };
  }, [data]);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleAction = async (id: string, status: "RESOLVED" | "DISMISSED") => {
    try {
      await api.patch(`/duplicates/${id}/resolve`, { status });
      toast.success(status === "RESOLVED" ? "Marked as resolved" : "Dismissed as not duplicate");
      void fetchData();
    } catch {
      toast.error("Failed to update group");
    }
  };

  const handleMerge = async (groupId: string, primaryCandidateId: string) => {
    setMerging(true);
    try {
      await mergeDuplicates(groupId, primaryCandidateId);
      toast.success("Duplicates merged successfully");
      void fetchData();
    } catch {
      toast.error("Failed to merge duplicates");
    } finally {
      setMerging(false);
    }
  };

  // Find matching fields across members (phone or email duplicates)
  const findMatches = (members: DuplicateMember[]) => {
    const phones = members.map((m) => m.candidateReport.contactNo).filter(Boolean);
    const emails = members.map((m) => m.candidateReport.emailId).filter(Boolean);
    const matchedPhones = phones.filter((p, i) => phones.indexOf(p) !== i);
    const matchedEmails = emails.filter((e, i) => emails.indexOf(e) !== i);
    return { phones: new Set(matchedPhones), emails: new Set(matchedEmails) };
  };

  const groups = data?.data ?? [];
  const pagination = data?.pagination;

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Duplicate Management"
        actions={
          pendingCount > 0 ? <Badge variant="danger">{pendingCount} pending</Badge> : undefined
        }
      />

      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card padding="sm">
          <div className="flex items-center gap-3">
            <div className="bg-primary-100 flex h-10 w-10 items-center justify-center rounded-lg">
              <Copy size={18} className="text-primary-600" />
            </div>
            <div>
              <p className="text-text-muted text-xs">Total Groups</p>
              <p className="text-text-primary text-xl font-bold">{stats.total}</p>
            </div>
          </div>
        </Card>
        <Card padding="sm">
          <div className="flex items-center gap-3">
            <div className="bg-warning-100 flex h-10 w-10 items-center justify-center rounded-lg">
              <AlertTriangle size={18} className="text-warning-600" />
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
              <CheckCircle2 size={18} className="text-success-600" />
            </div>
            <div>
              <p className="text-text-muted text-xs">Resolved</p>
              <p className="text-success-600 text-xl font-bold">{stats.resolved}</p>
            </div>
          </div>
        </Card>
        <Card padding="sm">
          <div className="flex items-center gap-3">
            <div className="bg-info-100 flex h-10 w-10 items-center justify-center rounded-lg">
              <Users size={18} className="text-info-600" />
            </div>
            <div>
              <p className="text-text-muted text-xs">Candidates</p>
              <p className="text-info-600 text-xl font-bold">{stats.totalMembers}</p>
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
        placeholder="Search duplicates by name or phone..."
        historyKey="duplicates"
        className="max-w-sm"
      />

      {/* Status Tabs */}
      <Tabs
        tabs={STATUS_TABS.map((t) => ({
          ...t,
          badge: t.id === "PENDING" ? pendingCount : undefined,
        }))}
        activeTab={statusFilter}
        onChange={(id) => {
          setStatusFilter(id as DuplicateStatusId);
          setPage(1);
        }}
        variant="bordered"
      />

      {/* Content */}
      {isLoading ? (
        <TableSkeleton />
      ) : groups.length === 0 ? (
        <EmptyState
          icon={Copy}
          title="No duplicate groups found"
          description="No candidate duplicates detected for the selected filter"
        />
      ) : (
        <div className="space-y-3">
          {groups.map((group) => {
            const isExpanded = expandedIds.has(group.id);
            const matches = findMatches(group.members);
            return (
              <Card key={group.id} padding="sm" className="overflow-hidden">
                {/* Group Header */}
                <button
                  onClick={() => toggleExpand(group.id)}
                  className="hover:bg-bg-hover flex w-full items-center justify-between rounded-lg px-2 py-1 text-left"
                >
                  <div className="flex items-center gap-3">
                    {isExpanded ? (
                      <ChevronDown size={16} className="text-text-muted" />
                    ) : (
                      <ChevronRight size={16} className="text-text-muted" />
                    )}
                    <div>
                      <span className="text-text-primary text-sm font-medium">
                        Group #{group.id.slice(0, 8)}
                      </span>
                      <span className="text-text-muted ml-3 text-xs">
                        {new Date(group.detectedAt).toLocaleDateString("en-IN")} —{" "}
                        {group.members.length} candidates
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={STATUS_BADGE_VARIANT[group.status] ?? "default"}>
                      {group.status}
                    </Badge>
                    {group.status === "PENDING" && (
                      <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                        <Tooltip content="Resolve">
                          <IconButton
                            icon={CheckCircle}
                            aria-label="Resolve"
                            size="sm"
                            variant="success"
                            onClick={() => void handleAction(group.id, "RESOLVED")}
                          />
                        </Tooltip>
                        <Tooltip content="Dismiss">
                          <IconButton
                            icon={XCircle}
                            aria-label="Dismiss"
                            size="sm"
                            onClick={() => void handleAction(group.id, "DISMISSED")}
                          />
                        </Tooltip>
                      </div>
                    )}
                  </div>
                </button>

                {/* Expanded Comparison */}
                {isExpanded && (
                  <div className="border-border-default mt-2 border-t px-2 py-4">
                    <div
                      className={cn(
                        "grid gap-4",
                        group.members.length === 2
                          ? "grid-cols-2"
                          : group.members.length >= 3
                            ? "grid-cols-3"
                            : "grid-cols-1",
                      )}
                    >
                      {group.members.map((member, idx) => {
                        const c = member.candidateReport;
                        const phoneMatch = matches.phones.has(c.contactNo);
                        const emailMatch = matches.emails.has(c.emailId);
                        return (
                          <Card key={idx} padding="md">
                            <h4 className="text-text-primary font-semibold">{c.candidateName}</h4>
                            <div className="mt-2 space-y-1.5 text-sm">
                              <Row label="Contact" value={c.contactNo} highlighted={phoneMatch} />
                              <Row label="Email" value={c.emailId} highlighted={emailMatch} />
                              <Row
                                label="Recruiter"
                                value={
                                  c.recruiter
                                    ? `${c.recruiter.firstName} ${c.recruiter.lastName}`
                                    : "—"
                                }
                              />
                              <Row label="Company" value={c.company?.name ?? "—"} />
                              {c.dateSourced && (
                                <Row
                                  label="Sourced"
                                  value={new Date(c.dateSourced).toLocaleDateString("en-IN")}
                                />
                              )}
                              {c.zone && <Row label="Zone" value={c.zone} />}
                            </div>
                            {group.status === "PENDING" && member.candidateReportId && (
                              <Button
                                size="xs"
                                variant="outline"
                                leftIcon={GitMerge}
                                className="mt-3 w-full"
                                loading={merging}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void handleMerge(group.id, member.candidateReportId);
                                }}
                              >
                                Keep This &amp; Merge Others
                              </Button>
                            )}
                          </Card>
                        );
                      })}
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-text-muted text-sm">
            Showing {(pagination.page - 1) * pagination.limit + 1}–
            {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= pagination.totalPages}
              onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Small helper for labeled comparison rows */
function Row({
  label,
  value,
  highlighted,
}: {
  label: string;
  value: string;
  highlighted?: boolean;
}) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-text-muted shrink-0">{label}</span>
      <span
        className={cn(
          "truncate text-right",
          highlighted
            ? "bg-error-100 text-error-500 rounded-sm px-1 font-semibold"
            : "text-text-primary",
        )}
      >
        {value}
      </span>
    </div>
  );
}
