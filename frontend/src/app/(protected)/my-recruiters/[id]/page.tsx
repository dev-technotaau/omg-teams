"use client";

import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { qk } from "@/lib/query-keys";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Card, Badge, Avatar, DataTable, Tabs, Progress, TableSkeleton } from "@/components/ui";
import type { Column } from "@/components/ui";
import { useTabSearchParam } from "@/hooks";

const RECRUITER_DETAIL_TAB_IDS = ["performance", "submissions", "attendance", "leave"] as const;
type RecruiterDetailTabId = (typeof RECRUITER_DETAIL_TAB_IDS)[number];

// ──────────────────────────────────────────────
//  Recruiter Detail (Read-only) — Spec Section 7
//  Gap 6: click-through from My Recruiters
// ──────────────────────────────────────────────

interface RecruiterDetail {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  employeeId: string | null;
  role: string;
  status: string;
  profilePhotoUrl: string | null;
  mobileNumber: string | null;
  createdAt: string;
}

interface CandidateRecord {
  id: string;
  globalSerialNumber: number;
  candidateName: string;
  contactNo: string;
  zone: string;
  status: string;
  createdAt: string;
}

interface AttendanceRecord {
  id: string;
  date: string;
  punchInTime: string | null;
  punchOutTime: string | null;
  netWorkingMinutes: number | null;
  status: string;
  isLate: boolean;
}

interface LeaveRecord {
  id: string;
  startDate: string;
  endDate: string;
  numberOfDays: number;
  reason: string;
  status: string;
  leaveType: { name: string };
}

const TAB_ITEMS = [
  { id: "performance", label: "Performance" },
  { id: "submissions", label: "Recent Submissions" },
  { id: "attendance", label: "Attendance" },
  { id: "leave", label: "Leave" },
];

export default function RecruiterDetailPage() {
  const params = useParams();
  const router = useRouter();
  const recruiterId = params.id as string;

  const [recruiter, setRecruiter] = useState<RecruiterDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useTabSearchParam<RecruiterDetailTabId>(
    "tab",
    "performance",
    RECRUITER_DETAIL_TAB_IDS,
  );
  const [tabLoading, setTabLoading] = useState(false);

  // Tab data
  const [submissions, setSubmissions] = useState<CandidateRecord[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [leaves, setLeaves] = useState<LeaveRecord[]>([]);
  const [perfStats, setPerfStats] = useState<{
    today: number;
    month: number;
    completionRate: number;
  } | null>(null);

  // Server state — recruiter detail. Sync into local state because the rest
  // of the page mutates `recruiter` directly through several setters.
  const recruiterQuery = useQuery({
    queryKey: qk.myRecruiters.detail(recruiterId),
    queryFn: async () => {
      const res = await api.get<{ user: RecruiterDetail }>(`/users/${recruiterId}/team-view`);
      return res.data.user ?? (res.data as unknown as RecruiterDetail);
    },
  });
  useEffect(() => {
    if (recruiterQuery.data) {
      setRecruiter(recruiterQuery.data);
      setIsLoading(false);
    }
    if (recruiterQuery.isError) {
      toast.error("Failed to load recruiter");
      router.push("/my-recruiters");
    }
  }, [recruiterQuery.data, recruiterQuery.isError, router]);

  const fetchTabData = useCallback(
    async (tab: string) => {
      setTabLoading(true);
      try {
        switch (tab) {
          case "performance": {
            const res = await api.get<{
              stats: Record<string, { today: number; month: number; completionRate: number }>;
            }>("/candidates/stats/by-recruiter", {
              params: { recruiterIds: recruiterId },
            });
            setPerfStats(res.data.stats?.[recruiterId] ?? null);
            break;
          }
          case "submissions": {
            const res = await api.get<{ data: CandidateRecord[] }>(
              `/candidates?recruiterId=${recruiterId}&limit=20`,
            );
            setSubmissions(res.data.data ?? []);
            break;
          }
          case "attendance": {
            const res = await api.get<{ data: AttendanceRecord[] }>(
              `/attendance?userId=${recruiterId}&limit=30`,
            );
            setAttendance(res.data.data ?? []);
            break;
          }
          case "leave": {
            const res = await api.get<{ data: LeaveRecord[] }>(
              `/leaves?userId=${recruiterId}&limit=20`,
            );
            setLeaves(res.data.data ?? []);
            break;
          }
        }
      } catch {
        /* silent */
      } finally {
        setTabLoading(false);
      }
    },
    [recruiterId],
  );

  useEffect(() => {
    void fetchTabData(activeTab);
  }, [activeTab, fetchTabData]);

  if (isLoading) return <TableSkeleton />;
  if (!recruiter) return null;

  const name = `${recruiter.firstName} ${recruiter.lastName}`;

  const submissionCols: Column<CandidateRecord>[] = [
    {
      key: "sn",
      header: "#",
      cell: (r) => <span className="text-text-muted text-xs">{r.globalSerialNumber}</span>,
    },
    {
      key: "candidateName",
      header: "Candidate",
      cell: (r) => <span className="text-sm font-medium">{r.candidateName}</span>,
    },
    {
      key: "zone",
      header: "Zone",
      cell: (r) => (
        <Badge variant="default" size="sm">
          {r.zone}
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
    {
      key: "date",
      header: "Date",
      cell: (r) => (
        <span className="text-text-muted text-xs">
          {new Date(r.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
        </span>
      ),
    },
  ];

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
        r.netWorkingMinutes
          ? `${Math.floor(r.netWorkingMinutes / 60)}h ${r.netWorkingMinutes % 60}m`
          : "\u2014",
    },
    {
      key: "status",
      header: "Status",
      cell: (r) => (
        <Badge
          variant={
            r.status === "PRESENT_FULL" ? "success" : r.status === "ABSENT" ? "danger" : "warning"
          }
          size="sm"
        >
          {r.status.replace("_", " ")}
        </Badge>
      ),
    },
    {
      key: "late",
      header: "Late",
      cell: (r) =>
        r.isLate ? (
          <Badge variant="warning" size="sm">
            Late
          </Badge>
        ) : null,
    },
  ];

  const leaveCols: Column<LeaveRecord>[] = [
    {
      key: "type",
      header: "Type",
      cell: (r) => (
        <Badge variant="default" size="sm">
          {r.leaveType.name}
        </Badge>
      ),
    },
    {
      key: "dates",
      header: "Dates",
      cell: (r) =>
        `${new Date(r.startDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} - ${new Date(r.endDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`,
    },
    { key: "days", header: "Days", cell: (r) => r.numberOfDays },
    {
      key: "reason",
      header: "Reason",
      cell: (r) => <span className="max-w-xs truncate text-xs">{r.reason}</span>,
    },
    {
      key: "status",
      header: "Status",
      cell: (r) => (
        <Badge
          variant={
            r.status === "APPROVED" ? "success" : r.status === "REJECTED" ? "danger" : "warning"
          }
          size="sm"
        >
          {r.status}
        </Badge>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <button
        onClick={() => router.push("/my-recruiters")}
        className="text-text-muted hover:text-text-secondary flex items-center gap-1.5 text-sm transition-colors"
      >
        <ArrowLeft size={14} />
        Back to My Recruiters
      </button>

      <Card className="p-6">
        <div className="flex items-center gap-4">
          <Avatar name={name} src={recruiter.profilePhotoUrl} size="lg" />
          <div>
            <h1 className="text-text-primary text-xl font-bold">{name}</h1>
            <p className="text-text-muted text-sm">
              {recruiter.email} {recruiter.employeeId && `\u00b7 ${recruiter.employeeId}`}
            </p>
            <div className="mt-1 flex items-center gap-2">
              <Badge variant={recruiter.status === "ACTIVE" ? "success" : "default"} dot>
                {recruiter.status}
              </Badge>
              <span className="text-text-muted text-xs">
                Joined {new Date(recruiter.createdAt).toLocaleDateString("en-IN")}
              </span>
            </div>
          </div>
        </div>
      </Card>

      <Tabs
        tabs={TAB_ITEMS}
        activeTab={activeTab}
        onChange={(id) => setActiveTab(id as RecruiterDetailTabId)}
        variant="underline"
      />

      {tabLoading ? (
        <TableSkeleton />
      ) : (
        <>
          {activeTab === "performance" && (
            <Card className="p-6">
              {perfStats ? (
                <div className="grid grid-cols-1 gap-4 text-center sm:grid-cols-3 sm:gap-6">
                  <div>
                    <p className="text-text-primary text-3xl font-bold">{perfStats.today}</p>
                    <p className="text-text-muted mt-1 text-sm">Candidates Today</p>
                  </div>
                  <div>
                    <p className="text-text-primary text-3xl font-bold">{perfStats.month}</p>
                    <p className="text-text-muted mt-1 text-sm">This Month</p>
                  </div>
                  <div>
                    <p className="text-text-primary text-3xl font-bold">
                      {perfStats.completionRate}%
                    </p>
                    <p className="text-text-muted mt-1 text-sm">Completion Rate</p>
                    <Progress value={perfStats.completionRate} size="sm" className="mt-2" />
                  </div>
                </div>
              ) : (
                <p className="text-text-muted text-center text-sm">No performance data yet</p>
              )}
            </Card>
          )}

          {activeTab === "submissions" && (
            <DataTable
              columns={submissionCols}
              data={submissions}
              emptyTitle="No submissions"
              emptyDescription="This recruiter has no recent candidate submissions."
            />
          )}

          {activeTab === "attendance" && (
            <DataTable
              columns={attendanceCols}
              data={attendance}
              emptyTitle="No attendance records"
              emptyDescription="No attendance data found."
            />
          )}

          {activeTab === "leave" && (
            <DataTable
              columns={leaveCols}
              data={leaves}
              emptyTitle="No leave requests"
              emptyDescription="No leave data found."
            />
          )}
        </>
      )}
    </div>
  );
}
