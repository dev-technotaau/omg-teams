"use client";

import { useState, useEffect } from "react";
import { Calendar as CalendarIcon, Table2 } from "lucide-react";
import { api } from "@/lib/api";
import { isToday as checkIsToday } from "@/utils/date";
import { PageHeader, Card, DataTable, Badge } from "@/components/ui";
import { TableSkeleton } from "@/components/ui/skeleton";
import type { Column } from "@/components/ui";
import { cn } from "@/lib/utils";
import { ATTENDANCE_STATUS_BADGE, ATTENDANCE_CALENDAR_COLORS } from "@/constants/statuses";
import type { AttendanceRecord } from "@/types/attendance";

type ViewMode = "table" | "calendar";

export default function MyAttendancePage() {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [calMonth, setCalMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  useEffect(() => {
    void api
      .get<{ records: AttendanceRecord[] }>("/attendance/my")
      .then((res) => setRecords(res.data.records))
      .finally(() => setIsLoading(false));
  }, []);

  const presentDays = records.filter((r) => r.status.startsWith("PRESENT")).length;
  const halfDays = records.filter((r) => r.status === "PRESENT_HALF").length;
  const lateDays = records.filter((r) => r.isLate).length;
  const absentDays = records.filter((r) => r.status === "ABSENT").length;
  const totalMinutes = records.reduce((sum, r) => sum + (r.netWorkingMinutes ?? 0), 0);

  // Calendar helpers
  const daysInMonth = new Date(calMonth.year, calMonth.month + 1, 0).getDate();
  const firstDayOfWeek = new Date(calMonth.year, calMonth.month, 1).getDay();
  const recordMap = new Map(records.map((r) => [r.date.split("T")[0], r]));
  const monthLabel = new Date(calMonth.year, calMonth.month).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });

  const prevMonth = () =>
    setCalMonth((p) =>
      p.month === 0 ? { year: p.year - 1, month: 11 } : { ...p, month: p.month - 1 },
    );
  const nextMonth = () =>
    setCalMonth((p) =>
      p.month === 11 ? { year: p.year + 1, month: 0 } : { ...p, month: p.month + 1 },
    );

  const columns: Column<AttendanceRecord>[] = [
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
      key: "punchInTime",
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
      key: "punchOutTime",
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
      key: "netWorkingMinutes",
      header: "Working Hours",
      cell: (r) =>
        r.netWorkingMinutes != null
          ? `${Math.floor(r.netWorkingMinutes / 60)}h ${r.netWorkingMinutes % 60}m`
          : "\u2014",
    },
    {
      key: "status",
      header: "Status",
      cell: (r) => (
        <Badge variant={ATTENDANCE_STATUS_BADGE[r.status] ?? "default"}>
          {r.status.replace("_", " ")}
        </Badge>
      ),
    },
    {
      key: "lateByMinutes",
      header: "Late By",
      cell: (r) => (r.isLate && r.lateByMinutes ? `${r.lateByMinutes}m` : "\u2014"),
    },
  ];

  if (isLoading) return <TableSkeleton />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Attendance"
        actions={
          <div className="border-border-default bg-bg-muted flex gap-1 rounded-lg border p-1">
            <button
              onClick={() => setViewMode("table")}
              className={cn(
                "rounded-md p-1.5 transition-colors",
                viewMode === "table" ? "bg-bg-surface shadow-xs" : "text-text-muted",
              )}
            >
              <Table2 size={16} />
            </button>
            <button
              onClick={() => setViewMode("calendar")}
              className={cn(
                "rounded-md p-1.5 transition-colors",
                viewMode === "calendar" ? "bg-bg-surface shadow-xs" : "text-text-muted",
              )}
            >
              <CalendarIcon size={16} />
            </button>
          </div>
        }
      />

      {/* Monthly Summary Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
        <Card className="text-center">
          <p className="text-success-500 text-2xl font-bold">{presentDays}</p>
          <p className="text-text-muted text-xs">Present</p>
        </Card>
        <Card className="text-center">
          <p className="text-warning-400 text-2xl font-bold">{halfDays}</p>
          <p className="text-text-muted text-xs">Half Day</p>
        </Card>
        <Card className="text-center">
          <p className="text-warning-500 text-2xl font-bold">{lateDays}</p>
          <p className="text-text-muted text-xs">Late</p>
        </Card>
        <Card className="text-center">
          <p className="text-error-500 text-2xl font-bold">{absentDays}</p>
          <p className="text-text-muted text-xs">Absent</p>
        </Card>
        <Card className="text-center">
          <p className="text-accent-blue text-2xl font-bold">{Math.floor(totalMinutes / 60)}h</p>
          <p className="text-text-muted text-xs">Total Hours</p>
        </Card>
        <Card className="text-center">
          <p className="text-text-secondary text-2xl font-bold">
            {presentDays > 0
              ? `${Math.floor(totalMinutes / presentDays / 60)}h ${Math.floor((totalMinutes / presentDays) % 60)}m`
              : "\u2014"}
          </p>
          <p className="text-text-muted text-xs">Avg Daily</p>
        </Card>
      </div>

      {/* Table View */}
      {viewMode === "table" && (
        <DataTable
          columns={columns}
          data={records}
          loading={isLoading}
          emptyTitle="No attendance records"
          emptyDescription="Your attendance records will appear here."
        />
      )}

      {/* Calendar View */}
      {viewMode === "calendar" && (
        <Card>
          <Card.Header>
            <div className="flex items-center justify-between">
              <button
                onClick={prevMonth}
                className="hover:bg-bg-muted rounded-sm px-2 py-1 text-sm"
              >
                &larr;
              </button>
              <h3 className="text-text-primary text-sm font-semibold">{monthLabel}</h3>
              <button
                onClick={nextMonth}
                className="hover:bg-bg-muted rounded-sm px-2 py-1 text-sm"
              >
                &rarr;
              </button>
            </div>
          </Card.Header>
          <Card.Body>
            {/* Weekday headers */}
            <div className="grid grid-cols-7 gap-1 text-center">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                <div key={d} className="text-text-muted py-1 text-xs font-medium">
                  {d}
                </div>
              ))}
              {/* Empty cells before first day */}
              {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                <div key={`empty-${i}`} />
              ))}
              {/* Day cells */}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const dateStr = `${calMonth.year}-${String(calMonth.month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                const record = recordMap.get(dateStr);
                const calColor = record
                  ? (ATTENDANCE_CALENDAR_COLORS[record.status] ?? {
                      bg: "bg-bg-muted",
                      text: "text-text-muted",
                    })
                  : null;
                const isToday = checkIsToday(dateStr);

                return (
                  <div
                    key={day}
                    className={cn(
                      "group relative flex h-10 flex-col items-center justify-center rounded-md text-xs transition-colors",
                      isToday && "ring-primary-500 ring-2",
                      record && calColor ? calColor.bg : "",
                      record ? "cursor-default" : "text-text-muted",
                    )}
                  >
                    <span
                      className={cn("text-text-primary", record && calColor ? calColor.text : "")}
                    >
                      {day}
                    </span>
                    {record && calColor && (
                      <span
                        className={cn(
                          "mt-0.5 h-1.5 w-1.5 rounded-full",
                          calColor.text.replace("text-", "bg-"),
                        )}
                      />
                    )}
                    {/* Tooltip */}
                    {record && (
                      <div className="bg-bg-surface-raised absolute -top-10 left-1/2 z-10 hidden -translate-x-1/2 rounded-sm px-2 py-1 text-[10px] whitespace-nowrap shadow-sm group-hover:block">
                        {record.status.replace("_", " ")}
                        {record.netWorkingMinutes != null &&
                          ` \u2022 ${Math.floor(record.netWorkingMinutes / 60)}h ${record.netWorkingMinutes % 60}m`}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Legend */}
            <div className="border-border-default mt-4 flex flex-wrap gap-3 border-t pt-3">
              {[
                { label: "Present", color: "bg-success-500" },
                { label: "Half Day", color: "bg-warning-400" },
                { label: "Late", color: "bg-warning-500" },
                { label: "Absent", color: "bg-error-500" },
                { label: "On Leave", color: "bg-info-500" },
              ].map((l) => (
                <div key={l.label} className="flex items-center gap-1">
                  <span className={cn("h-2 w-2 rounded-full", l.color)} />
                  <span className="text-text-muted text-[10px]">{l.label}</span>
                </div>
              ))}
            </div>
          </Card.Body>
        </Card>
      )}
    </div>
  );
}
