"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { qk } from "@/lib/query-keys";
import Link from "next/link";
import { Plus, Download } from "lucide-react";
import { useAuth } from "@/contexts/auth";
import {
  listCandidates,
  type CandidateReport,
} from "@/services/candidate.service";
import { exportToXLSX } from "@/utils/export-table";
import {
  PageHeader,
  SearchInput,
  Select,
  DataTable,
  Badge,
  Button,
  EmptyState,
} from "@/components/ui";
import type { Column } from "@/components/ui";
import { getDraft } from "@/services/draft.service";
import { ROLES } from "@/constants/roles";
import { DEFAULT_PAGE_SIZE } from "@/constants/pagination";

// ──────────────────────────────────────────────
//  My Reports / Team Reports — Data Table
//  Spec Section 5.6, 12
// ──────────────────────────────────────────────

const PAGE_SIZE = DEFAULT_PAGE_SIZE;

const statusOptions = [
  { value: "", label: "All Status" },
  { value: "COMPLETE", label: "Complete" },
  { value: "PENDING", label: "Pending" },
];

export default function ReportsPage() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [hasDraft, setHasDraft] = useState(false);

  // §5.3 — Check if recruiter has an existing draft
  useEffect(() => {
    if (user?.role === ROLES.RECRUITER) {
      void getDraft().then((draft) => setHasDraft(!!draft));
    }
  }, [user]);

  const reportsQuery = useQuery({
    queryKey: qk.reports.list({ page, search, statusFilter }),
    queryFn: () => {
      const params: Record<string, string> = { page: String(page), limit: String(PAGE_SIZE) };
      if (search) params["search"] = search;
      if (statusFilter) params["status"] = statusFilter;
      return listCandidates(params);
    },
    placeholderData: keepPreviousData,
  });
  const data = reportsQuery.data ?? null;
  const isLoading = reportsQuery.isLoading;
  const isRecruiter = user?.role === ROLES.RECRUITER;

  const columns = useMemo<Column<CandidateReport>[]>(
    () => [
      {
        key: "index",
        header: "#",
        width: "60px",
        cell: (_row: CandidateReport) => {
          // §5.2 #1 / §5.6 — Recruiter-scoped serial: oldest = #1
          // List is sorted newest-first, so reverse the numbering
          const idx = data?.data.indexOf(_row) ?? 0;
          const total = data?.pagination.total ?? 0;
          const serial = total - ((page - 1) * PAGE_SIZE + idx);
          return <span className="text-text-muted">{serial}</span>;
        },
      },
      {
        key: "candidateName",
        header: "Name",
        cell: (row: CandidateReport) => (
          <Link
            href={`/reports/${row.id}`}
            className="text-text-primary hover:text-text-link font-medium"
          >
            {row.candidateName ?? "—"}
          </Link>
        ),
      },
      {
        key: "contactNo",
        header: "Contact",
        cell: (row: CandidateReport) => (
          <span className="text-text-secondary">{row.contactNo ?? "—"}</span>
        ),
      },
      {
        key: "zone",
        header: "Zone",
        cell: (row: CandidateReport) => (
          <Badge variant="default" size="sm">
            {row.zone}
          </Badge>
        ),
      },
      {
        key: "profile",
        header: "Profile",
        cell: (row: CandidateReport) => (
          <span className="text-text-secondary">{row.profile ?? "—"}</span>
        ),
      },
      {
        key: "candidateStage",
        header: "Stage",
        cell: (row: CandidateReport) => (
          <Badge variant="info" size="sm">
            {row.candidateStage.replace("_", " ")}
          </Badge>
        ),
      },
      {
        key: "status",
        header: "Status",
        cell: (row: CandidateReport) => (
          <Badge variant={row.status === "COMPLETE" ? "success" : "warning"} size="sm">
            {row.status ?? "PENDING"}
          </Badge>
        ),
      },
      {
        key: "createdAt",
        header: "Date",
        cell: (row: CandidateReport) => (
          <span className="text-text-muted">
            {new Date(row.createdAt).toLocaleDateString("en-IN")}
          </span>
        ),
      },
    ],
    [data, page],
  );

  const handleSearch = useCallback((value: string) => {
    setSearch(value);
    setPage(1);
  }, []);

  const handleStatusChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setStatusFilter(e.target.value);
    setPage(1);
  }, []);

  // §5.3 — Add Report button with draft badge
  const addReportButton = isRecruiter ? (
    <Link href="/reports/new">
      <Button leftIcon={Plus}>
        Add Report
        {hasDraft && (
          <Badge variant="warning" size="sm" className="ml-2">
            Draft
          </Badge>
        )}
      </Button>
    </Link>
  ) : undefined;

  // When data is empty and not loading, show EmptyState directly
  if (!isLoading && (!data || data.data.length === 0)) {
    return (
      <div className="space-y-4">
        <PageHeader
          title={isRecruiter ? "My Reports" : "Candidate Reports"}
          actions={addReportButton}
        />
        <div className="flex flex-wrap items-center gap-3">
          <SearchInput
            value={search}
            onChange={handleSearch}
            placeholder="Search by name, phone, email..."
            historyKey="reports"
            className="max-w-sm flex-1"
          />
          <Select
            options={statusOptions}
            value={statusFilter}
            onChange={handleStatusChange}
            className="w-40"
          />
          <Button
            variant="outline"
            leftIcon={Download}
            onClick={() => {
              const rows = data?.data ?? [];
              if (rows.length === 0) return;
              exportToXLSX(
                rows,
                [
                  { header: "Sr No", accessor: (r) => r.globalSerialNumber },
                  { header: "Candidate Name", accessor: (r) => r.candidateName },
                  { header: "Contact", accessor: (r) => r.contactNo },
                  { header: "Email", accessor: (r) => r.emailId },
                  { header: "Zone", accessor: (r) => r.zone },
                  { header: "State", accessor: (r) => r.state },
                  { header: "Location", accessor: (r) => r.location },
                  { header: "Profile", accessor: (r) => r.profile },
                  { header: "Stage", accessor: (r) => r.candidateStage },
                  { header: "Status", accessor: (r) => r.status },
                  {
                    header: "Date",
                    accessor: (r) => new Date(r.createdAt).toLocaleDateString("en-IN"),
                  },
                  {
                    header: "Recruiter",
                    accessor: (r) => `${r.recruiter.firstName} ${r.recruiter.lastName}`,
                  },
                  { header: "Company", accessor: (r) => r.company?.name ?? "" },
                ],
                `candidate-reports-${new Date().toISOString().split("T")[0]}`,
              );
            }}
          >
            Export
          </Button>
        </div>
        <EmptyState
          title="No reports yet"
          description={
            isRecruiter
              ? "Start by adding your first candidate report"
              : "No candidate reports match your filters"
          }
          action={
            isRecruiter ? (
              <Link href="/reports/new">
                <Button>Add Report</Button>
              </Link>
            ) : undefined
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={isRecruiter ? "My Reports" : "Candidate Reports"}
        actions={addReportButton}
      />

      {/* Filters */}
      <div className="flex items-center gap-3">
        <SearchInput
          value={search}
          onChange={handleSearch}
          placeholder="Search by name, phone, email..."
          historyKey="reports"
          className="max-w-sm flex-1"
        />
        <Select
          options={statusOptions}
          value={statusFilter}
          onChange={handleStatusChange}
          className="w-40"
        />
        <Button
          variant="outline"
          leftIcon={Download}
          onClick={() => {
            const rows = data?.data ?? [];
            if (rows.length === 0) return;
            exportToXLSX(
              rows,
              [
                { header: "Sr No", accessor: (r) => r.globalSerialNumber },
                { header: "Candidate Name", accessor: (r) => r.candidateName },
                { header: "Contact", accessor: (r) => r.contactNo },
                { header: "Email", accessor: (r) => r.emailId },
                { header: "Zone", accessor: (r) => r.zone },
                { header: "State", accessor: (r) => r.state },
                { header: "Location", accessor: (r) => r.location },
                { header: "Profile", accessor: (r) => r.profile },
                { header: "Stage", accessor: (r) => r.candidateStage },
                { header: "Status", accessor: (r) => r.status },
                {
                  header: "Date",
                  accessor: (r) => new Date(r.createdAt).toLocaleDateString("en-IN"),
                },
                {
                  header: "Recruiter",
                  accessor: (r) => `${r.recruiter.firstName} ${r.recruiter.lastName}`,
                },
                { header: "Company", accessor: (r) => r.company?.name ?? "" },
              ],
              `candidate-reports-${new Date().toISOString().split("T")[0]}`,
            );
          }}
        >
          Export
        </Button>
      </div>

      {/* Table with built-in pagination */}
      <DataTable<CandidateReport>
        columns={columns}
        data={data?.data ?? []}
        loading={isLoading}
        page={page}
        pageSize={PAGE_SIZE}
        totalPages={data?.pagination.totalPages ?? 1}
        total={data?.pagination.total}
        onPageChange={setPage}
        emptyTitle="No reports yet"
        emptyDescription={
          isRecruiter
            ? "Start by adding your first candidate report"
            : "No candidate reports match your filters"
        }
      />
    </div>
  );
}
