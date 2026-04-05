"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Plus,
  Pencil,
  PowerOff,
  Target as TargetIcon,
  Search,
  Users,
  TrendingUp,
  BarChart3,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import {
  listTargets,
  createTarget,
  updateTarget,
  deleteTarget,
  type Target,
} from "@/services/target.service";
import { exportToXLSX } from "@/utils/export-table";
import {
  PageHeader,
  Button,
  IconButton,
  Modal,
  FormField,
  Input,
  Select,
  DatePicker,
  DataTable,
  Badge,
  Progress,
  ConfirmDialog,
  Card,
  FilterPresetsBar,
  Tooltip,
} from "@/components/ui";
import type { Column, ViewType, RowDensity } from "@/components/ui";
import { useFilterPresets } from "@/hooks/use-filter-presets";
import { TARGET_TYPE_BADGE } from "@/constants/statuses";
import { targetSchema } from "@/validators/target";

// ──────────────────────────────────────────────
//  Admin Targets Management — Spec Section 23.9
// ──────────────────────────────────────────────

interface Recruiter {
  id: string;
  firstName: string;
  lastName: string;
  employeeId: string | null;
}

const TYPE_BADGE_VARIANT = TARGET_TYPE_BADGE;

const emptyForm = {
  recruiterId: "",
  targetType: "DAILY" as Target["targetType"],
  targetValue: "",
  effectiveFrom: "",
  effectiveTo: "",
};

export default function AdminTargetsPage() {
  const [targets, setTargets] = useState<Target[]>([]);
  const [recruiters, setRecruiters] = useState<Recruiter[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterRecruiter, setFilterRecruiter] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterStatus, setFilterStatus] = useState("active");
  const [modal, setModal] = useState<"add" | "edit" | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState<string | null>(null);
  const [deactivateId, setDeactivateId] = useState<string | null>(null);
  const [recruiterSearch, setRecruiterSearch] = useState("");
  const [viewType, setViewType] = useState<ViewType>("table");
  const [density, setDensity] = useState<RowDensity>("default");
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set());
  const { presets, activePresetId, savePreset, applyPreset, deletePreset, clearActive } =
    useFilterPresets("admin-targets");

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const filters: { recruiterId?: string; isActive?: boolean } = {};
      if (filterRecruiter) filters.recruiterId = filterRecruiter;
      if (filterStatus === "active") filters.isActive = true;
      else if (filterStatus === "inactive") filters.isActive = false;
      let data = await listTargets(filters);
      if (filterType) data = data.filter((t) => t.targetType === filterType);
      setTargets(data);
    } catch {
      toast.error("Failed to load targets");
    } finally {
      setIsLoading(false);
    }
  }, [filterRecruiter, filterType, filterStatus]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  useEffect(() => {
    api
      .get<{ data: Recruiter[] }>("/users", { params: { role: "RECRUITER", limit: "500" } })
      .then((r) => setRecruiters(r.data.data))
      .catch(() => {});
  }, []);

  // Summary stats
  const activeTargets = targets.filter((t) => t.isActive);
  const uniqueRecruiters = new Set(activeTargets.map((t) => t.recruiterId)).size;
  const avgDaily =
    activeTargets.filter((t) => t.targetType === "DAILY").reduce((s, t) => s + t.targetValue, 0) /
    (activeTargets.filter((t) => t.targetType === "DAILY").length || 1);
  const achievementRate = activeTargets.length
    ? Math.round(
        activeTargets.reduce(
          (s, t) => s + Math.min(100, ((t.achieved ?? 0) / t.targetValue) * 100),
          0,
        ) / activeTargets.length,
      )
    : 0;

  const openAdd = () => {
    setForm(emptyForm);
    setModal("add");
  };
  const openEdit = (t: Target) => {
    setForm({
      recruiterId: t.recruiterId,
      targetType: t.targetType,
      targetValue: String(t.targetValue),
      effectiveFrom: t.effectiveFrom.slice(0, 10),
      effectiveTo: t.effectiveTo?.slice(0, 10) ?? "",
    });
    setEditId(t.id);
    setModal("edit");
  };

  const handleSave = async () => {
    const raw = {
      ...form,
      targetValue: Number(form.targetValue),
      effectiveTo: form.effectiveTo || undefined,
    };
    const parsed = targetSchema.safeParse(raw);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Validation failed");
      return;
    }
    const payload = parsed.data;
    try {
      if (modal === "add") {
        await createTarget(payload);
        toast.success("Target created");
      } else if (editId) {
        await updateTarget(editId, {
          targetValue: payload.targetValue,
          effectiveTo: payload.effectiveTo,
        });
        toast.success("Target updated");
      }
      setModal(null);
      void fetchData();
    } catch {
      toast.error("Failed to save target");
    }
  };

  const handleDeactivate = async () => {
    if (!deactivateId) return;
    try {
      await deleteTarget(deactivateId);
      toast.success("Target deactivated");
      setDeactivateId(null);
      void fetchData();
    } catch {
      toast.error("Failed to deactivate");
    }
  };

  const filteredRecruiters = recruiters.filter((r) =>
    `${r.firstName} ${r.lastName}`.toLowerCase().includes(recruiterSearch.toLowerCase()),
  );

  // DataTable columns
  const columns: Column<Target>[] = [
    {
      key: "recruiter",
      header: "Recruiter",
      cell: (t) => (
        <div>
          <p className="text-text-primary font-medium">
            {t.recruiter.firstName} {t.recruiter.lastName}
          </p>
          <p className="text-text-muted text-xs">{t.recruiter.employeeId}</p>
        </div>
      ),
    },
    {
      key: "targetType",
      header: "Type",
      cell: (t) => <Badge variant={TYPE_BADGE_VARIANT[t.targetType]}>{t.targetType}</Badge>,
    },
    {
      key: "targetValue",
      header: "Target",
      cell: (t) => <span className="text-text-primary font-semibold">{t.targetValue}</span>,
    },
    {
      key: "effectiveFrom",
      header: "Effective From",
      cell: (t) => (
        <span className="text-text-secondary">
          {new Date(t.effectiveFrom).toLocaleDateString("en-IN")}
        </span>
      ),
    },
    {
      key: "effectiveTo",
      header: "Effective To",
      cell: (t) => (
        <span className="text-text-secondary">
          {t.effectiveTo ? new Date(t.effectiveTo).toLocaleDateString("en-IN") : "Ongoing"}
        </span>
      ),
    },
    {
      key: "isActive",
      header: "Status",
      cell: (t) => (
        <Badge variant={t.isActive ? "success" : "default"}>
          {t.isActive ? "Active" : "Inactive"}
        </Badge>
      ),
    },
    {
      key: "achieved",
      header: "Achievement",
      cell: (t) => {
        const achieved = t.achieved ?? 0;
        const pct = Math.min(100, Math.round((achieved / t.targetValue) * 100));
        const variant = pct >= 100 ? "success" : pct >= 50 ? "primary" : "warning";
        return (
          <div className="flex items-center gap-2">
            <Progress value={pct} variant={variant} size="sm" className="w-24" />
            <span className="text-text-muted text-xs">
              {achieved}/{t.targetValue}
            </span>
          </div>
        );
      },
    },
    {
      key: "actions",
      header: "Actions",
      cell: (t) => (
        <div className="flex gap-1">
          <Tooltip content="Edit target">
            <IconButton
              icon={Pencil}
              aria-label="Edit target"
              size="sm"
              variant="ghost"
              onClick={() => openEdit(t)}
            />
          </Tooltip>
          {t.isActive && (
            <Tooltip content="Deactivate target">
              <IconButton
                icon={PowerOff}
                aria-label="Deactivate target"
                size="sm"
                variant="danger"
                onClick={() => setDeactivateId(t.id)}
              />
            </Tooltip>
          )}
        </div>
      ),
    },
  ];

  const cardRenderer = useCallback(
    (t: Target) => (
      <Card padding="sm" className="transition-shadow hover:shadow-md">
        <div className="space-y-3">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-text-primary font-medium">
                {t.recruiter.firstName} {t.recruiter.lastName}
              </p>
              <p className="text-text-muted text-xs">{t.recruiter.employeeId}</p>
            </div>
            <Badge variant={TYPE_BADGE_VARIANT[t.targetType]}>{t.targetType}</Badge>
          </div>
          <div className="flex items-center gap-2">
            <Progress
              value={Math.min(100, Math.round(((t.achieved ?? 0) / t.targetValue) * 100))}
              variant={
                (t.achieved ?? 0) / t.targetValue >= 1
                  ? "success"
                  : (t.achieved ?? 0) / t.targetValue >= 0.5
                    ? "primary"
                    : "warning"
              }
              size="sm"
              className="flex-1"
            />
            <span className="text-text-muted text-xs">
              {t.achieved ?? 0}/{t.targetValue}
            </span>
          </div>
          <div className="border-border-default flex items-center justify-between border-t pt-2 text-xs">
            <span className="text-text-muted">
              {new Date(t.effectiveFrom).toLocaleDateString("en-IN")} —{" "}
              {t.effectiveTo ? new Date(t.effectiveTo).toLocaleDateString("en-IN") : "Ongoing"}
            </span>
            <Badge variant={t.isActive ? "success" : "default"} size="sm">
              {t.isActive ? "Active" : "Inactive"}
            </Badge>
          </div>
        </div>
      </Card>
    ),
    [],
  );

  const detailRenderer = useCallback(
    (t: Target) => (
      <div className="space-y-4">
        <div>
          <p className="text-text-primary text-lg font-semibold">
            {t.recruiter.firstName} {t.recruiter.lastName}
          </p>
          <p className="text-text-muted text-sm">{t.recruiter.employeeId}</p>
        </div>
        <div className="border-border-default divide-border-default divide-y rounded-lg border">
          {[
            ["Type", t.targetType],
            ["Target Value", String(t.targetValue)],
            ["Achieved", String(t.achieved ?? 0)],
            [
              "Achievement %",
              `${Math.min(100, Math.round(((t.achieved ?? 0) / t.targetValue) * 100))}%`,
            ],
            ["Effective From", new Date(t.effectiveFrom).toLocaleDateString("en-IN")],
            [
              "Effective To",
              t.effectiveTo ? new Date(t.effectiveTo).toLocaleDateString("en-IN") : "Ongoing",
            ],
            ["Status", t.isActive ? "Active" : "Inactive"],
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
        title="Targets Management"
        actions={
          <Button leftIcon={Plus} onClick={openAdd}>
            Set Target
          </Button>
        }
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card padding="sm">
          <div className="flex items-center gap-3">
            <div className="bg-primary-100 flex h-10 w-10 items-center justify-center rounded-lg">
              <TargetIcon size={18} className="text-primary-600" />
            </div>
            <div>
              <p className="text-text-muted text-xs">Active Targets</p>
              <p className="text-text-primary text-xl font-bold">{activeTargets.length}</p>
            </div>
          </div>
        </Card>
        <Card padding="sm">
          <div className="flex items-center gap-3">
            <div className="bg-success-100 flex h-10 w-10 items-center justify-center rounded-lg">
              <Users size={18} className="text-success-600" />
            </div>
            <div>
              <p className="text-text-muted text-xs">Recruiters</p>
              <p className="text-success-600 text-xl font-bold">{uniqueRecruiters}</p>
            </div>
          </div>
        </Card>
        <Card padding="sm">
          <div className="flex items-center gap-3">
            <div className="bg-info-100 flex h-10 w-10 items-center justify-center rounded-lg">
              <BarChart3 size={18} className="text-info-600" />
            </div>
            <div>
              <p className="text-text-muted text-xs">Avg Daily</p>
              <p className="text-info-600 text-xl font-bold">{Math.round(avgDaily)}</p>
            </div>
          </div>
        </Card>
        <Card padding="sm">
          <div className="flex items-center gap-3">
            <div className="bg-warning-100 flex h-10 w-10 items-center justify-center rounded-lg">
              <TrendingUp size={18} className="text-warning-600" />
            </div>
            <div>
              <p className="text-text-muted text-xs">Achievement</p>
              <p className="text-warning-600 text-xl font-bold">{achievementRate}%</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Select
          value={filterRecruiter}
          onChange={(e) => setFilterRecruiter(e.target.value)}
          placeholder="All Recruiters"
          options={recruiters.map((r) => ({ value: r.id, label: `${r.firstName} ${r.lastName}` }))}
        />
        <Select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          placeholder="All Types"
          options={[
            { value: "DAILY", label: "Daily" },
            { value: "WEEKLY", label: "Weekly" },
            { value: "MONTHLY", label: "Monthly" },
          ]}
        />
        <Select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          options={[
            { value: "", label: "All" },
            { value: "active", label: "Active" },
            { value: "inactive", label: "Inactive" },
          ]}
        />
      </div>

      <FilterPresetsBar
        presets={presets}
        activePresetId={activePresetId}
        onApply={(id) => {
          const filters = applyPreset(id);
          if (filters) {
            if (filters.recruiter) setFilterRecruiter(filters.recruiter);
            if (filters.type) setFilterType(filters.type);
            if (filters.status) setFilterStatus(filters.status);
          }
        }}
        onSave={(name) =>
          savePreset(name, {
            ...(filterRecruiter && { recruiter: filterRecruiter }),
            ...(filterType && { type: filterType }),
            ...(filterStatus && { status: filterStatus }),
          })
        }
        onDelete={deletePreset}
        onClear={clearActive}
      />

      {/* Data Table */}
      <DataTable<Target>
        columns={columns}
        data={targets}
        loading={isLoading}
        emptyIcon={TargetIcon}
        emptyTitle="No targets found"
        emptyDescription="Set targets for recruiters to track performance"
        viewType={viewType}
        onViewTypeChange={setViewType}
        cardRenderer={cardRenderer}
        enableColumnVisibility
        density={density}
        onDensityChange={setDensity}
        pinnedIds={pinnedIds}
        onPinChange={setPinnedIds}
        detailRenderer={detailRenderer}
        detailTitle={(t) => `${t.recruiter.firstName} ${t.recruiter.lastName} — ${t.targetType}`}
        enableKeyboardNav
        onExport={() => {
          exportToXLSX(
            targets,
            [
              {
                header: "Recruiter",
                accessor: (t) => `${t.recruiter.firstName} ${t.recruiter.lastName}`,
              },
              { header: "Employee ID", accessor: (t) => t.recruiter.employeeId },
              { header: "Type", accessor: (t) => t.targetType },
              { header: "Target Value", accessor: (t) => t.targetValue },
              { header: "Achieved", accessor: (t) => t.achieved ?? 0 },
              {
                header: "Effective From",
                accessor: (t) => new Date(t.effectiveFrom).toLocaleDateString("en-IN"),
              },
              {
                header: "Effective To",
                accessor: (t) =>
                  t.effectiveTo ? new Date(t.effectiveTo).toLocaleDateString("en-IN") : "Ongoing",
              },
              { header: "Status", accessor: (t) => (t.isActive ? "Active" : "Inactive") },
            ],
            "targets",
          );
        }}
      />

      {/* Set/Edit Target Modal */}
      <Modal
        open={!!modal}
        onClose={() => setModal(null)}
        title={modal === "add" ? "Set Target" : "Edit Target"}
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={() => setModal(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => void handleSave()}
              disabled={
                modal === "add"
                  ? !form.recruiterId || !form.targetValue || !form.effectiveFrom
                  : !form.targetValue
              }
            >
              Save
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {modal === "add" && (
            <FormField label="Recruiter" required>
              <div className="relative">
                <Search
                  size={14}
                  className="text-text-muted absolute top-1/2 left-3 -translate-y-1/2"
                />
                <Input
                  value={recruiterSearch}
                  onChange={(e) => setRecruiterSearch(e.target.value)}
                  placeholder="Search recruiters..."
                  className="pl-8"
                />
              </div>
              {recruiterSearch && (
                <div className="border-border-default bg-bg-surface mt-1 max-h-32 overflow-y-auto rounded-md border">
                  {filteredRecruiters.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => {
                        setForm({ ...form, recruiterId: r.id });
                        setRecruiterSearch(`${r.firstName} ${r.lastName}`);
                      }}
                      className="hover:bg-bg-hover block w-full px-3 py-1.5 text-left text-sm"
                    >
                      {r.firstName} {r.lastName}{" "}
                      <span className="text-text-muted">({r.employeeId})</span>
                    </button>
                  ))}
                </div>
              )}
            </FormField>
          )}
          {modal === "add" && (
            <FormField label="Target Type" required>
              <div className="flex gap-2">
                {(["DAILY", "WEEKLY", "MONTHLY"] as const).map((t) => (
                  <Button
                    key={t}
                    variant={form.targetType === t ? "primary" : "outline"}
                    onClick={() => setForm({ ...form, targetType: t })}
                    fullWidth
                  >
                    {t[0] + t.slice(1).toLowerCase()}
                  </Button>
                ))}
              </div>
            </FormField>
          )}
          <FormField label="Target Value" required htmlFor="target-value">
            <Input
              id="target-value"
              type="number"
              min={1}
              value={form.targetValue}
              onChange={(e) => setForm({ ...form, targetValue: e.target.value })}
              placeholder="e.g. 10"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleSave();
              }}
            />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Effective From" required htmlFor="effective-from">
              <DatePicker
                id="effective-from"
                value={form.effectiveFrom}
                onChange={(value) => setForm({ ...form, effectiveFrom: value })}
                disabled={modal === "edit"}
              />
            </FormField>
            <FormField label="Effective To" helpText="Optional" htmlFor="effective-to">
              <DatePicker
                id="effective-to"
                value={form.effectiveTo}
                onChange={(value) => setForm({ ...form, effectiveTo: value })}
              />
            </FormField>
          </div>
        </div>
      </Modal>

      {/* Deactivate Confirm */}
      <ConfirmDialog
        open={!!deactivateId}
        onClose={() => setDeactivateId(null)}
        onConfirm={handleDeactivate}
        title="Deactivate Target"
        description="Are you sure you want to deactivate this target? The recruiter will no longer be tracked against it."
        confirmLabel="Deactivate"
        variant="warning"
      />
    </div>
  );
}
