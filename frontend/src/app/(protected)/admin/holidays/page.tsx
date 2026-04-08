"use client";

import { useState, useCallback, useMemo } from "react";
import { Plus, Pencil, Trash2, CalendarDays, RefreshCw, Globe, MapPin, Star } from "lucide-react";
import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listHolidays,
  createHoliday,
  updateHoliday,
  deleteHoliday,
  type Holiday,
} from "@/services/holiday.service";
import { qk } from "@/lib/query-keys";
import { toastApiError } from "@/lib/query-helpers";
import {
  PageHeader,
  Button,
  IconButton,
  Tooltip,
  Modal,
  FormField,
  Input,
  Select,
  Checkbox,
  DatePicker,
  DataTable,
  Badge,
  TableSkeleton,
  ConfirmDialog,
  Card,
} from "@/components/ui";
import type { Column, ViewType, RowDensity } from "@/components/ui";
import { cn } from "@/lib/utils";
import { HOLIDAY_TYPE_BADGE, HOLIDAY_DOT_COLORS } from "@/constants/statuses";

// ──────────────────────────────────────────────
//  Admin Holiday Calendar — Spec Section 27.9
// ──────────────────────────────────────────────

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const TYPE_OPTIONS: Holiday["type"][] = ["NATIONAL", "REGIONAL", "CUSTOM"];
const TYPE_BADGE_VARIANT = HOLIDAY_TYPE_BADGE;
const DOT_COLORS = HOLIDAY_DOT_COLORS;

const emptyForm = { date: "", name: "", type: "NATIONAL" as Holiday["type"], isRecurring: false };

export default function AdminHolidaysPage() {
  const qc = useQueryClient();
  const [year, setYear] = useState(new Date().getFullYear());
  const [modal, setModal] = useState<"add" | "edit" | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [viewType, setViewType] = useState<ViewType>("table");
  const [density, setDensity] = useState<RowDensity>("default");
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set());

  // ── Server state via TanStack Query ──
  // Keyed by year so each tab navigation hits cache instantly. Background
  // refetches on focus keep the table fresh without skeletons.
  const { data: holidays = [], isLoading } = useQuery({
    queryKey: qk.holidays.list({ year }),
    queryFn: () => listHolidays(year),
  });

  // Helper used by mutations to invalidate every cached holiday list
  // (every year combo) after a write succeeds.
  const invalidateHolidays = useCallback(
    () => qc.invalidateQueries({ queryKey: qk.holidays.lists() }),
    [qc],
  );

  // Optimistic create — prepend to the current year's cache before the
  // server confirms, snapshot for rollback, and reconcile on settle.
  const createMutation = useMutation({
    mutationFn: createHoliday,
    onMutate: async (vars) => {
      const key = qk.holidays.list({ year });
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<Holiday[]>(key);
      const optimistic: Holiday = {
        id: `__temp_${Date.now()}`,
        date: vars.date,
        name: vars.name,
        type: vars.type ?? "NATIONAL",
        isRecurring: vars.isRecurring ?? false,
        creator: null,
      };
      qc.setQueryData<Holiday[]>(key, (old) => [...(old ?? []), optimistic]);
      return { prev, key };
    },
    onError: (err, _vars, ctx) => {
      if (ctx) qc.setQueryData(ctx.key, ctx.prev);
      toastApiError(err, "Failed to save holiday");
    },
    onSuccess: () => toast.success("Holiday added"),
    onSettled: () => void invalidateHolidays(),
  });

  // Optimistic update — patch in place across the cached year list.
  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: typeof form }) =>
      updateHoliday(id, payload),
    onMutate: async ({ id, payload }) => {
      const key = qk.holidays.list({ year });
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<Holiday[]>(key);
      qc.setQueryData<Holiday[]>(key, (old) =>
        (old ?? []).map((h) => (h.id === id ? { ...h, ...payload } : h)),
      );
      return { prev, key };
    },
    onError: (err, _vars, ctx) => {
      if (ctx) qc.setQueryData(ctx.key, ctx.prev);
      toastApiError(err, "Failed to save holiday");
    },
    onSuccess: () => toast.success("Holiday updated"),
    onSettled: () => void invalidateHolidays(),
  });

  // Optimistic delete — remove from cache instantly.
  const deleteMutation = useMutation({
    mutationFn: deleteHoliday,
    onMutate: async (id: string) => {
      const key = qk.holidays.list({ year });
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<Holiday[]>(key);
      qc.setQueryData<Holiday[]>(key, (old) => (old ?? []).filter((h) => h.id !== id));
      return { prev, key };
    },
    onError: (err, _id, ctx) => {
      if (ctx) qc.setQueryData(ctx.key, ctx.prev);
      toastApiError(err, "Failed to delete");
    },
    onSuccess: () => toast.success("Holiday deleted"),
    onSettled: () => void invalidateHolidays(),
  });

  const holidayMap = useMemo(() => {
    const map: Record<string, Holiday[]> = {};
    for (const h of holidays) {
      const key = h.date.slice(0, 10);
      (map[key] ??= []).push(h);
    }
    return map;
  }, [holidays]);

  const stats = useMemo(() => {
    const total = holidays.length;
    const national = holidays.filter((h) => h.type === "NATIONAL").length;
    const regional = holidays.filter((h) => h.type === "REGIONAL").length;
    const custom = holidays.filter((h) => h.type === "CUSTOM").length;
    return { total, national, regional, custom };
  }, [holidays]);

  const openAdd = () => {
    setForm(emptyForm);
    setModal("add");
  };
  const openEdit = (h: Holiday) => {
    setForm({ date: h.date.slice(0, 10), name: h.name, type: h.type, isRecurring: h.isRecurring });
    setEditId(h.id);
    setModal("edit");
  };

  const handleSave = () => {
    if (modal === "add") {
      createMutation.mutate(form);
    } else if (editId) {
      updateMutation.mutate({ id: editId, payload: form });
    }
    setModal(null);
  };

  const handleDelete = () => {
    if (!deleteId) return;
    deleteMutation.mutate(deleteId);
    setDeleteId(null);
  };

  // Build month grid: array of 6 weeks x 7 days (null = outside month)
  const buildMonthGrid = (month: number) => {
    const first = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const startDay = first.getDay();
    const grid: (number | null)[] = [];
    for (let i = 0; i < startDay; i++) grid.push(null);
    for (let d = 1; d <= daysInMonth; d++) grid.push(d);
    while (grid.length < 42) grid.push(null);
    return grid;
  };

  const dateKey = (month: number, day: number) => {
    const m = String(month + 1).padStart(2, "0");
    const d = String(day).padStart(2, "0");
    return `${year}-${m}-${d}`;
  };

  // DataTable columns
  const columns: Column<Holiday>[] = [
    {
      key: "date",
      header: "Date",
      cell: (h) =>
        new Date(h.date).toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        }),
    },
    {
      key: "name",
      header: "Name",
      cell: (h) => <span className="text-text-primary font-medium">{h.name}</span>,
    },
    {
      key: "type",
      header: "Type",
      cell: (h) => <Badge variant={TYPE_BADGE_VARIANT[h.type]}>{h.type}</Badge>,
    },
    {
      key: "isRecurring",
      header: "Recurring",
      cell: (h) =>
        h.isRecurring ? (
          <RefreshCw size={14} className="text-primary-500" />
        ) : (
          <span className="text-text-muted">&mdash;</span>
        ),
    },
    {
      key: "creator",
      header: "Created By",
      cell: (h) => (
        <span className="text-text-secondary">
          {h.creator ? `${h.creator.firstName} ${h.creator.lastName}` : "\u2014"}
        </span>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      cell: (h) => (
        <div className="flex gap-1">
          <Tooltip content="Edit holiday">
            <IconButton
              icon={Pencil}
              aria-label="Edit holiday"
              size="sm"
              variant="ghost"
              onClick={() => openEdit(h)}
            />
          </Tooltip>
          <Tooltip content="Delete holiday">
            <IconButton
              icon={Trash2}
              aria-label="Delete holiday"
              size="sm"
              variant="danger"
              onClick={() => setDeleteId(h.id)}
            />
          </Tooltip>
        </div>
      ),
    },
  ];

  const cardRenderer = useCallback(
    (h: Holiday) => (
      <Card padding="sm" className="transition-shadow hover:shadow-md">
        <div className="space-y-2">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-text-primary font-medium">{h.name}</p>
              <p className="text-text-muted text-xs">
                {new Date(h.date).toLocaleDateString("en-IN", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })}
              </p>
            </div>
            <Badge variant={TYPE_BADGE_VARIANT[h.type]}>{h.type}</Badge>
          </div>
          <div className="border-border-default flex items-center justify-between border-t pt-2 text-xs">
            <span className="text-text-muted">
              {h.creator ? `${h.creator.firstName} ${h.creator.lastName}` : "\u2014"}
            </span>
            {h.isRecurring && (
              <Badge variant="info" size="sm">
                Recurring
              </Badge>
            )}
          </div>
        </div>
      </Card>
    ),
    [],
  );

  const detailRendererHoliday = useCallback(
    (h: Holiday) => (
      <div className="space-y-4">
        <p className="text-text-primary text-lg font-semibold">{h.name}</p>
        <div className="border-border-default divide-border-default divide-y rounded-lg border">
          {[
            [
              "Date",
              new Date(h.date).toLocaleDateString("en-IN", {
                day: "2-digit",
                month: "long",
                year: "numeric",
              }),
            ],
            ["Type", h.type],
            ["Recurring", h.isRecurring ? "Yes" : "No"],
            ["Created By", h.creator ? `${h.creator.firstName} ${h.creator.lastName}` : "\u2014"],
          ].map(([label, value]) => (
            <div key={String(label)} className="flex justify-between px-4 py-2.5 text-sm">
              <span className="text-text-muted">{label}</span>
              <span className="text-text-primary font-medium">{value}</span>
            </div>
          ))}
        </div>
      </div>
    ),
    [],
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Holiday Calendar"
        actions={
          <>
            <Select
              options={[year - 1, year, year + 1].map((y) => ({
                value: String(y),
                label: String(y),
              }))}
              value={String(year)}
              onChange={(e) => setYear(Number(e.target.value))}
            />
            <Button leftIcon={Plus} onClick={openAdd}>
              Add Holiday
            </Button>
          </>
        }
      />

      {isLoading ? (
        <TableSkeleton />
      ) : (
        <>
          {/* Stat Cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Card padding="sm">
              <div className="flex items-center gap-3">
                <div className="bg-primary-100 flex h-10 w-10 items-center justify-center rounded-lg">
                  <CalendarDays size={18} className="text-primary-600" />
                </div>
                <div>
                  <p className="text-text-muted text-xs">Total Holidays</p>
                  <p className="text-text-primary text-xl font-bold">{stats.total}</p>
                </div>
              </div>
            </Card>
            <Card padding="sm">
              <div className="flex items-center gap-3">
                <div className="bg-success-100 flex h-10 w-10 items-center justify-center rounded-lg">
                  <Globe size={18} className="text-success-600" />
                </div>
                <div>
                  <p className="text-text-muted text-xs">National</p>
                  <p className="text-success-600 text-xl font-bold">{stats.national}</p>
                </div>
              </div>
            </Card>
            <Card padding="sm">
              <div className="flex items-center gap-3">
                <div className="bg-info-100 flex h-10 w-10 items-center justify-center rounded-lg">
                  <MapPin size={18} className="text-info-600" />
                </div>
                <div>
                  <p className="text-text-muted text-xs">Regional</p>
                  <p className="text-info-600 text-xl font-bold">{stats.regional}</p>
                </div>
              </div>
            </Card>
            <Card padding="sm">
              <div className="flex items-center gap-3">
                <div className="bg-warning-100 flex h-10 w-10 items-center justify-center rounded-lg">
                  <Star size={18} className="text-warning-600" />
                </div>
                <div>
                  <p className="text-text-muted text-xs">Custom</p>
                  <p className="text-warning-600 text-xl font-bold">{stats.custom}</p>
                </div>
              </div>
            </Card>
          </div>

          {/* Calendar Grid — kept as-is (specialized) */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {MONTHS.map((mName, mi) => (
              <div
                key={mName}
                className="border-border-default bg-bg-surface rounded-lg border p-3"
              >
                <h3 className="text-text-primary mb-2 text-sm font-semibold">{mName}</h3>
                <div className="grid grid-cols-7 gap-px text-center text-[10px]">
                  {DAY_LABELS.map((d) => (
                    <div key={d} className="text-text-muted py-0.5 font-medium">
                      {d}
                    </div>
                  ))}
                  {buildMonthGrid(mi).map((day, idx) => {
                    const key = day ? dateKey(mi, day) : `e-${idx}`;
                    const hols = day ? holidayMap[dateKey(mi, day)] : undefined;
                    return (
                      <div
                        key={key}
                        className="relative flex h-7 items-center justify-center"
                        title={hols?.map((h) => h.name).join(", ")}
                      >
                        <span
                          className={cn(
                            "text-[11px]",
                            day ? "text-text-secondary" : "text-transparent",
                          )}
                        >
                          {day ?? ""}
                        </span>
                        {hols && (
                          <div className="absolute bottom-0 left-1/2 flex -translate-x-1/2 gap-0.5">
                            {hols.slice(0, 3).map((h) => (
                              <span
                                key={h.id}
                                className={cn("h-1 w-1 rounded-full", DOT_COLORS[h.type])}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Holiday Table */}
          <DataTable<Holiday>
            columns={columns}
            data={holidays}
            emptyIcon={CalendarDays}
            emptyTitle="No holidays found"
            emptyDescription={`No holidays configured for ${year}`}
            viewType={viewType}
            onViewTypeChange={setViewType}
            cardRenderer={cardRenderer}
            enableColumnVisibility
            density={density}
            onDensityChange={setDensity}
            pinnedIds={pinnedIds}
            onPinChange={setPinnedIds}
            detailRenderer={detailRendererHoliday}
            detailTitle={(h) => h.name}
            enableKeyboardNav
          />
        </>
      )}

      {/* Add/Edit Modal */}
      <Modal
        open={!!modal}
        onClose={() => setModal(null)}
        title={modal === "add" ? "Add Holiday" : "Edit Holiday"}
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={() => setModal(null)}>
              Cancel
            </Button>
            <Button onClick={() => void handleSave()} disabled={!form.date || !form.name}>
              Save
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <FormField label="Date" required htmlFor="holiday-date">
            <DatePicker
              id="holiday-date"
              value={form.date}
              onChange={(value) => setForm({ ...form, date: value })}
            />
          </FormField>
          <FormField label="Name" required htmlFor="holiday-name">
            <Input
              id="holiday-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Republic Day"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleSave();
              }}
            />
          </FormField>
          <FormField label="Type" htmlFor="holiday-type">
            <Select
              id="holiday-type"
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value as Holiday["type"] })}
              options={TYPE_OPTIONS.map((t) => ({
                value: t,
                label: t[0] + t.slice(1).toLowerCase(),
              }))}
            />
          </FormField>
          <Checkbox
            checked={form.isRecurring}
            onChange={(checked) => setForm({ ...form, isRecurring: checked })}
            label="Recurring every year"
          />
        </div>
      </Modal>

      {/* Delete Confirm */}
      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete Holiday"
        description="Are you sure you want to delete this holiday? This action cannot be undone."
        confirmLabel="Delete"
      />
    </div>
  );
}
