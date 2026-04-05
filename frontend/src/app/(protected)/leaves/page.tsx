"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, CalendarDays, Table2, Calendar as CalendarIcon } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { leaveRequestSchema } from "@/validators/leave";
import { isToday as checkIsToday } from "@/utils/date";
import {
  PageHeader,
  Card,
  DataTable,
  Badge,
  Button,
  Modal,
  FormField,
  Input,
  DatePicker,
  Select,
  Textarea,
  Progress,
  EmptyState,
  TableSkeleton,
  Checkbox,
} from "@/components/ui";
import type { Column } from "@/components/ui";
import { cn } from "@/lib/utils";
import { LEAVE_STATUS_BADGE } from "@/constants/statuses";
import type { LeaveRequest, LeaveBalance, LeaveType } from "@/types/leave";

const leaveCalColor: Record<string, string> = {
  APPROVED: "bg-success-500",
  PENDING: "bg-warning-500",
  REJECTED: "bg-error-500",
  CANCELLED: "bg-text-muted",
};

type ViewMode = "table" | "calendar";

export default function MyLeavesPage() {
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [types, setTypes] = useState<LeaveType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [calMonth, setCalMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  // Form state
  const [formLeaveTypeId, setFormLeaveTypeId] = useState("");
  const [formStartDate, setFormStartDate] = useState("");
  const [formEndDate, setFormEndDate] = useState("");
  const [formIsHalfDay, setFormIsHalfDay] = useState(false);
  const [formReason, setFormReason] = useState("");

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [reqRes, balRes, typRes] = await Promise.all([
        api.get<{ requests: LeaveRequest[] }>("/leaves/my"),
        api.get<{ balances: LeaveBalance[] }>("/leaves/balances"),
        api.get<{ types: LeaveType[] }>("/leaves/types"),
      ]);
      setRequests(reqRes.data.requests);
      setBalances(balRes.data.balances);
      setTypes(typRes.data.types);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const resetForm = () => {
    setFormLeaveTypeId("");
    setFormStartDate("");
    setFormEndDate("");
    setFormIsHalfDay(false);
    setFormReason("");
  };

  const handleSubmit = async () => {
    const parsed = leaveRequestSchema.safeParse({
      leaveTypeId: formLeaveTypeId,
      startDate: formStartDate,
      endDate: formEndDate,
      reason: formReason,
      isHalfDay: formIsHalfDay,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Validation failed");
      return;
    }
    try {
      await api.post("/leaves", parsed.data);
      toast.success("Leave request submitted");
      setShowForm(false);
      resetForm();
      void fetchData();
    } catch {
      toast.error("Failed to submit leave request");
    }
  };

  const handleCancel = async (id: string) => {
    try {
      await api.patch(`/leaves/${id}/cancel`);
      toast.success("Leave request cancelled");
      void fetchData();
    } catch {
      toast.error("Failed to cancel");
    }
  };

  // Calendar helpers
  const daysInMonth = new Date(calMonth.year, calMonth.month + 1, 0).getDate();
  const firstDayOfWeek = new Date(calMonth.year, calMonth.month, 1).getDay();
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

  // Build date->leave map for calendar
  const leaveDateMap = new Map<string, LeaveRequest>();
  for (const r of requests) {
    if (r.status === "CANCELLED") continue;
    const start = new Date(r.startDate);
    const end = new Date(r.endDate);
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      leaveDateMap.set(d.toISOString().split("T")[0]!, r);
    }
  }

  const columns: Column<LeaveRequest>[] = [
    {
      key: "leaveType",
      header: "Type",
      cell: (r) => (
        <Badge variant="primary" size="sm">
          {r.leaveType.name}
        </Badge>
      ),
    },
    {
      key: "dateRange",
      header: "Date Range",
      cell: (r) =>
        `${new Date(r.startDate).toLocaleDateString("en-IN")} \u2014 ${new Date(r.endDate).toLocaleDateString("en-IN")}`,
    },
    {
      key: "numberOfDays",
      header: "Days",
      cell: (r) => `${r.numberOfDays}${r.isHalfDay ? " (half)" : ""}`,
    },
    {
      key: "reason",
      header: "Reason",
      cell: (r) => <span className="block max-w-xs truncate">{r.reason}</span>,
    },
    {
      key: "status",
      header: "Status",
      cell: (r) => <Badge variant={LEAVE_STATUS_BADGE[r.status] ?? "warning"}>{r.status}</Badge>,
    },
    {
      key: "action",
      header: "Action",
      cell: (r) => {
        const canCancel =
          r.status === "PENDING" || (r.status === "APPROVED" && new Date(r.startDate) > new Date());
        return canCancel ? (
          <Button variant="danger" size="xs" onClick={() => void handleCancel(r.id)}>
            Cancel
          </Button>
        ) : null;
      },
    },
  ];

  if (isLoading) return <TableSkeleton />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Leaves"
        actions={
          <div className="flex items-center gap-2">
            <div className="border-border-default bg-bg-muted flex gap-1 rounded-lg border p-1">
              <button
                onClick={() => setViewMode("table")}
                className={cn(
                  "rounded-md p-1.5",
                  viewMode === "table" ? "bg-bg-surface shadow-xs" : "text-text-muted",
                )}
              >
                <Table2 size={16} />
              </button>
              <button
                onClick={() => setViewMode("calendar")}
                className={cn(
                  "rounded-md p-1.5",
                  viewMode === "calendar" ? "bg-bg-surface shadow-xs" : "text-text-muted",
                )}
              >
                <CalendarIcon size={16} />
              </button>
            </div>
            <Button leftIcon={Plus} onClick={() => setShowForm(true)}>
              Apply Leave
            </Button>
          </div>
        }
      />

      {/* Balances */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {balances.map((b) => (
          <Card key={b.id} className="text-center">
            <p className="text-text-muted text-xs font-medium">{b.leaveType.code}</p>
            <p className="text-text-primary mt-1 text-lg font-bold">
              {b.remaining}/{b.totalAllotted}
            </p>
            <Progress
              value={b.remaining}
              max={b.totalAllotted > 0 ? b.totalAllotted : 1}
              size="sm"
              className="mt-2"
            />
          </Card>
        ))}
      </div>

      {/* Table View */}
      {viewMode === "table" &&
        (requests.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title="No leave requests"
            description="Apply for leave using the button above"
          />
        ) : (
          <DataTable columns={columns} data={requests} />
        ))}

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
            <div className="grid grid-cols-7 gap-1 text-center">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                <div key={d} className="text-text-muted py-1 text-xs font-medium">
                  {d}
                </div>
              ))}
              {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                <div key={`e-${i}`} />
              ))}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const dateStr = `${calMonth.year}-${String(calMonth.month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                const leave = leaveDateMap.get(dateStr);
                const isToday = checkIsToday(dateStr);

                return (
                  <div
                    key={day}
                    className={cn(
                      "group relative flex h-10 flex-col items-center justify-center rounded-md text-xs",
                      isToday && "ring-primary-500 ring-2",
                      leave && "cursor-default",
                    )}
                  >
                    <span className="text-text-primary">{day}</span>
                    {leave && (
                      <span
                        className={cn(
                          "mt-0.5 h-1.5 w-1.5 rounded-full",
                          leaveCalColor[leave.status] ?? "bg-warning-500",
                        )}
                      />
                    )}
                    {leave && (
                      <div className="bg-bg-surface-raised absolute -top-10 left-1/2 z-10 hidden -translate-x-1/2 rounded-sm px-2 py-1 text-[10px] whitespace-nowrap shadow-sm group-hover:block">
                        {leave.leaveType.name} ({leave.status})
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="border-border-default mt-4 flex flex-wrap gap-3 border-t pt-3">
              {[
                { label: "Approved", color: "bg-success-500" },
                { label: "Pending", color: "bg-warning-500" },
                { label: "Rejected", color: "bg-error-500" },
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

      {/* Apply Leave Modal */}
      <Modal
        open={showForm}
        onClose={() => {
          setShowForm(false);
          resetForm();
        }}
        title="Apply for Leave"
        size="md"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => {
                setShowForm(false);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button onClick={() => void handleSubmit()}>Submit</Button>
          </>
        }
      >
        <div className="space-y-4">
          <FormField label="Leave Type" required htmlFor="leaveTypeId">
            <Select
              id="leaveTypeId"
              value={formLeaveTypeId}
              onChange={(e) => setFormLeaveTypeId(e.target.value)}
              placeholder="Select Leave Type"
              options={types.map((t) => ({ value: t.id, label: `${t.name} (${t.code})` }))}
            />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Start Date" required htmlFor="startDate">
              <DatePicker
                id="startDate"
                value={formStartDate}
                onChange={(v) => setFormStartDate(v)}
              />
            </FormField>
            <FormField label="End Date" required htmlFor="endDate">
              <DatePicker id="endDate" value={formEndDate} onChange={(v) => setFormEndDate(v)} />
            </FormField>
          </div>
          <Checkbox
            checked={formIsHalfDay}
            onChange={(checked) => setFormIsHalfDay(checked)}
            label="Half Day"
          />
          <FormField label="Reason" required htmlFor="reason">
            <Textarea
              id="reason"
              value={formReason}
              onChange={(e) => setFormReason(e.target.value)}
              placeholder="Reason for leave (min 10 characters)"
              rows={3}
            />
          </FormField>
          {/* §28.2.1 — Supporting document upload (optional) */}
          <FormField label="Supporting Document (optional)" htmlFor="document">
            <Input id="document" type="file" accept=".pdf,.jpg,.jpeg,.png" className="text-sm" />
            <p className="text-text-muted mt-1 text-xs">
              PDF, JPEG, or PNG. Max 5 MB. (e.g., medical certificate for sick leave)
            </p>
          </FormField>
          {/* §28.2.1 — Emergency contact (optional) */}
          <FormField label="Emergency Contact (optional)" htmlFor="emergencyContact">
            <Input id="emergencyContact" type="tel" placeholder="Contact number during leave" />
          </FormField>
        </div>
      </Modal>
    </div>
  );
}
