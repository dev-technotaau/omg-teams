"use client";

import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { qk } from "@/lib/query-keys";
import { Users, Eye } from "lucide-react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { exportToXLSX } from "@/utils/export-table";
import { TableSkeleton } from "@/components/ui/skeleton";
import {
  PageHeader,
  SearchInput,
  DataTable,
  Badge,
  Avatar,
  IconButton,
  Tooltip,
} from "@/components/ui";
import type { Column } from "@/components/ui";
import { useDebounce } from "@/hooks";
import { usePresence, getPresenceDotClass } from "@/hooks/use-presence";
import { formatLastActive } from "@/hooks/use-firebase-presence";

// ──────────────────────────────────────────────
//  My Recruiters — Spec Section 7
//  View-only DataTable for Reporting Managers
//  Gap 5: search, sort, pagination, missing columns
// ──────────────────────────────────────────────

interface RecruiterInfo {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  employeeId: string | null;
  profilePhotoUrl: string | null;
  status: string;
  mobileNumber: string | null;
  candidatesToday?: number;
  candidatesMonth?: number;
  completionRate?: number;
  lastActive?: string | null;
  attendanceToday?: string | null;
  targetProgress?: number | null;
  kycStatus?: string | null;
}

export default function MyRecruitersPage() {
  const router = useRouter();
  const [filtered, setFiltered] = useState<RecruiterInfo[]>([]);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const recruitersQuery = useQuery({
    queryKey: qk.myRecruiters.list(),
    queryFn: async () => {
      const meRes = await api.get<{
        user: { managedRecruiters?: Array<{ recruiter: RecruiterInfo }> };
      }>("/auth/me");
      const managed = meRes.data.user.managedRecruiters ?? [];
      const recruiterList = managed.map((m) => m.recruiter);
      if (recruiterList.length > 0) {
        try {
          const [statsRes, snapRes] = await Promise.allSettled([
            api.get<{
              stats: Record<string, { today: number; month: number; completionRate: number }>;
            }>("/candidates/stats/by-recruiter", {
              params: { ids: recruiterList.map((r) => r.id).join(",") },
            }),
            api.get<{
              teamLogins: Array<{ name: string; punchIn: string; isLate: boolean }>;
            }>("/dashboard/rm-team-snapshot"),
          ]);
          if (statsRes.status === "fulfilled") {
            const statsMap = statsRes.value.data.stats ?? {};
            for (const r of recruiterList) {
              const s = statsMap[r.id];
              if (s) {
                r.candidatesToday = s.today;
                r.candidatesMonth = s.month;
                r.completionRate = s.completionRate;
              }
            }
          }
          if (snapRes.status === "fulfilled") {
            const teamLogins = snapRes.value.data.teamLogins ?? [];
            for (const r of recruiterList) {
              const fullName = `${r.firstName} ${r.lastName}`;
              const login = teamLogins.find((l) => l.name === fullName);
              if (login) r.attendanceToday = login.punchIn;
            }
          }
        } catch {
          /* stats/snapshot may not exist */
        }
      }
      return recruiterList;
    },
  });
  const recruiters = useMemo(() => recruitersQuery.data ?? [], [recruitersQuery.data]);
  const isLoading = recruitersQuery.isLoading;
  useEffect(() => {
    setFiltered(recruiters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recruitersQuery.data]);

  // §23.15 — Live presence for assigned recruiters
  const recruiterIds = useMemo(() => recruiters.map((r) => r.id), [recruiters]);
  const presenceMap = usePresence(recruiterIds);

  // Client-side search filter
  useEffect(() => {
    if (!debouncedSearch) {
      setFiltered(recruiters);
      setPage(1);
      return;
    }
    const q = debouncedSearch.toLowerCase();
    setFiltered(
      recruiters.filter(
        (r) =>
          `${r.firstName} ${r.lastName}`.toLowerCase().includes(q) ||
          (r.email && r.email.toLowerCase().includes(q)) ||
          (r.employeeId && r.employeeId.toLowerCase().includes(q)),
      ),
    );
    setPage(1);
  }, [debouncedSearch, recruiters]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageData = filtered.slice((page - 1) * pageSize, page * pageSize);

  const columns: Column<RecruiterInfo>[] = [
    {
      key: "name",
      header: "Recruiter",
      cell: (r) => {
        const presence = presenceMap[r.id];
        const dotClass = getPresenceDotClass(presence?.status ?? "offline");
        return (
          <div className="flex items-center gap-3">
            <div className="relative">
              <Avatar name={`${r.firstName} ${r.lastName}`} src={r.profilePhotoUrl} size="sm" />
              <span
                className={`absolute right-0 bottom-0 h-2.5 w-2.5 rounded-full border-2 border-white ${dotClass}`}
              />
            </div>
            <div>
              <p className="text-text-primary font-medium">
                {r.firstName} {r.lastName}
              </p>
              <p className="text-text-muted text-xs">{r.email}</p>
            </div>
          </div>
        );
      },
    },
    {
      key: "liveStatus",
      header: "Live Status",
      cell: (r) => {
        const presence = presenceMap[r.id];
        const status = presence?.status ?? "offline";
        return (
          <div>
            <Badge
              variant={status === "online" ? "success" : status === "idle" ? "warning" : "default"}
              size="sm"
              dot
            >
              {status === "online" ? "Online" : status === "idle" ? "Idle" : "Offline"}
            </Badge>
            {status !== "online" && presence?.lastActiveAt && (
              <p className="text-text-muted mt-0.5 text-[10px]">
                {formatLastActive(presence.lastActiveAt)}
              </p>
            )}
          </div>
        );
      },
    },
    {
      key: "candidatesToday",
      header: "Today",
      cell: (r) => (
        <span className="text-text-primary text-sm font-medium">{r.candidatesToday ?? 0}</span>
      ),
    },
    {
      key: "candidatesMonth",
      header: "This Month",
      cell: (r) => <span className="text-text-primary text-sm">{r.candidatesMonth ?? 0}</span>,
    },
    {
      key: "completionRate",
      header: "Completion %",
      cell: (r) => <span className="text-text-primary text-sm">{r.completionRate ?? 0}%</span>,
    },
    {
      key: "attendanceToday",
      header: "Attendance",
      cell: (r) => {
        if (!r.attendanceToday) return <span className="text-text-muted text-xs">Not In</span>;
        return (
          <span className="text-text-primary text-xs">
            {new Date(r.attendanceToday).toLocaleTimeString("en-IN", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        );
      },
    },
    {
      key: "targetProgress",
      header: "Target %",
      cell: (r) => {
        if (r.targetProgress == null)
          return <span className="text-text-muted text-xs">{"\u2014"}</span>;
        return <span className="text-text-primary text-xs">{r.targetProgress}%</span>;
      },
    },
    {
      key: "kycStatus",
      header: "KYC",
      cell: (r) => {
        if (!r.kycStatus) return <span className="text-text-muted text-xs">{"\u2014"}</span>;
        return (
          <Badge variant={r.kycStatus === "Complete" ? "success" : "warning"} size="sm">
            {r.kycStatus}
          </Badge>
        );
      },
    },
    {
      key: "lastActive",
      header: "Last Active",
      cell: (r) => {
        if (!r.lastActive) return <span className="text-text-muted text-xs">{"\u2014"}</span>;
        const diffMs = Date.now() - new Date(r.lastActive).getTime();
        const diffHrs = Math.floor(diffMs / 3600000);
        if (diffHrs < 1) return <span className="text-success-500 text-xs">Online now</span>;
        return <span className="text-text-muted text-xs">{diffHrs}h ago</span>;
      },
    },
    {
      key: "actions",
      header: "",
      cell: (r) => (
        <Tooltip content="View recruiter">
          <IconButton
            icon={Eye}
            aria-label="View recruiter"
            variant="ghost"
            size="sm"
            onClick={() => router.push(`/my-recruiters/${r.id}`)}
          />
        </Tooltip>
      ),
    },
  ];

  if (isLoading) return <TableSkeleton />;

  return (
    <div className="space-y-4">
      <PageHeader
        title="My Recruiters"
        description="View-only — assignments are managed by Admin"
      />

      <div className="flex flex-wrap items-center gap-3">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search by name, email, or Employee ID..."
          historyKey="recruiters"
          className="max-w-sm flex-1"
        />
      </div>

      <DataTable
        columns={columns}
        data={pageData}
        loading={isLoading}
        emptyIcon={Users}
        emptyTitle="No recruiters assigned"
        emptyDescription="Contact your admin to get recruiters assigned to you."
        page={page}
        totalPages={totalPages}
        total={filtered.length}
        pageSize={pageSize}
        onPageChange={setPage}
        onExport={() => {
          exportToXLSX(
            filtered,
            [
              { header: "First Name", accessor: (r) => r.firstName },
              { header: "Last Name", accessor: (r) => r.lastName },
              { header: "Email", accessor: (r) => r.email },
              { header: "Employee ID", accessor: (r) => r.employeeId },
              { header: "Status", accessor: (r) => r.status },
              { header: "Candidates Today", accessor: (r) => r.candidatesToday ?? 0 },
              { header: "Candidates This Month", accessor: (r) => r.candidatesMonth ?? 0 },
              { header: "Completion %", accessor: (r) => r.completionRate ?? 0 },
              { header: "Target %", accessor: (r) => r.targetProgress ?? null },
            ],
            "my-recruiters",
          );
        }}
      />
    </div>
  );
}
