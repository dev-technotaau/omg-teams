"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { qk } from "@/lib/query-keys";
import {
  Plus,
  Pencil,
  PowerOff,
  Target as TargetIcon,
  Search,
  Users,
  TrendingUp,
  BarChart3,
  Globe,
  X,
  Copy,
  History,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import {
  listTargets,
  createTarget,
  updateTarget,
  deleteTarget,
  getTargetHistory,
  type Target,
  type TargetHistoryEntry,
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
import { useClickOutside } from "@/hooks/use-click-outside";
import { TARGET_TYPE_BADGE } from "@/constants/statuses";
import { targetSchema } from "@/validators/target";
import { cn } from "@/lib/utils";

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

/**
 * Form state. `recruiterId === null` means "global default for all
 * recruiters" (the backend stores this as recruiterId=null and the
 * service merges it as a fallback for any recruiter without an
 * individual override of the same target type).
 *
 * `recruiterId === ""` is the unset state — Save is disabled until the
 * admin either picks a recruiter OR explicitly toggles "Global default".
 */
const emptyForm = {
  recruiterId: "" as string | null,
  targetType: "DAILY" as Target["targetType"],
  targetValue: "",
  effectiveFrom: "",
  effectiveTo: "",
};

export default function AdminTargetsPage() {
  const qc = useQueryClient();
  const [recruiters, setRecruiters] = useState<Recruiter[]>([]);
  const [filterRecruiter, setFilterRecruiter] = useState("");
  const [filterType, setFilterType] = useState("");
  // Default to "ACTIVE" so admin first sees currently-operational targets
  // (not future-dated or already-expired ones).
  const [filterStatus, setFilterStatus] = useState("ACTIVE");
  const [modal, setModal] = useState<"add" | "edit" | null>(null);
  const [form, setForm] = useState<typeof emptyForm>(emptyForm);
  const [editId, setEditId] = useState<string | null>(null);
  /** Status of the row being edited — drives whether effectiveFrom is editable
   *  (only SCHEDULED rows; once a target has started the start date is locked). */
  const [editStatus, setEditStatus] = useState<
    "ACTIVE" | "SCHEDULED" | "EXPIRED" | "INACTIVE" | null
  >(null);
  const [deactivateId, setDeactivateId] = useState<string | null>(null);
  /** Target whose history modal is open, or null when closed. */
  const [historyTarget, setHistoryTarget] = useState<Target | null>(null);
  const [recruiterSearch, setRecruiterSearch] = useState("");
  /** Suggestion list visibility — independent of the search input value
   *  so we can close the list when the admin picks a recruiter while
   *  keeping the chosen name visible. */
  const [recruiterPickerOpen, setRecruiterPickerOpen] = useState(false);
  const recruiterPickerRef = useRef<HTMLDivElement>(null);
  // Close the picker on outside click — see fix #9
  useClickOutside(recruiterPickerRef, () => {
    if (recruiterPickerOpen) setRecruiterPickerOpen(false);
  });
  const [viewType, setViewType] = useState<ViewType>("table");
  const [density, setDensity] = useState<RowDensity>("default");
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set());
  const { presets, activePresetId, savePreset, applyPreset, deletePreset, clearActive } =
    useFilterPresets("admin-targets");

  // Server state — targets, scoped to current filters. The status filter
  // uses the derived effectiveStatus on the backend (ACTIVE/SCHEDULED/
  // EXPIRED/INACTIVE), not the raw isActive boolean.
  const targetsQuery = useQuery({
    queryKey: qk.targets.list({ filterRecruiter, filterType, filterStatus }),
    queryFn: async () => {
      const filters: Parameters<typeof listTargets>[0] = {};
      if (filterRecruiter) filters.recruiterId = filterRecruiter;
      if (filterStatus === "ENDING_SOON") {
        filters.endingWithinDays = 7;
      } else if (
        filterStatus === "ACTIVE" ||
        filterStatus === "SCHEDULED" ||
        filterStatus === "EXPIRED" ||
        filterStatus === "INACTIVE"
      ) {
        filters.effectiveStatus = filterStatus;
      }
      let data = await listTargets(filters);
      if (filterType) data = data.filter((t) => t.targetType === filterType);
      return data;
    },
  });
  const targets = targetsQuery.data ?? [];
  const isLoading = targetsQuery.isLoading;

  const fetchData = useCallback(
    () => qc.invalidateQueries({ queryKey: qk.targets.lists() }),
    [qc],
  );

  useEffect(() => {
    api
      .get<{ data: Recruiter[] }>("/users", { params: { role: "RECRUITER", limit: "500" } })
      .then((r) => setRecruiters(r.data.data))
      .catch(() => {});
  }, []);

  // Summary stats — "active" here means currently effective (derived status
  // = ACTIVE), not just the raw isActive flag. Scheduled and expired rows
  // are excluded from the operational view. Global defaults are excluded
  // from "unique recruiters" count since they don't represent a single person.
  const activeTargets = targets.filter((t) => t.effectiveStatus === "ACTIVE");
  const uniqueRecruiters = new Set(
    activeTargets.filter((t) => t.recruiterId !== null).map((t) => t.recruiterId),
  ).size;
  const avgDaily =
    activeTargets.filter((t) => t.targetType === "DAILY").reduce((s, t) => s + t.targetValue, 0) /
    (activeTargets.filter((t) => t.targetType === "DAILY").length || 1);
  // Achievement rate is computed from per-recruiter targets only —
  // global defaults always have achieved=0 (they're a policy, not a
  // single person's progress) so including them would skew the average.
  const ratedTargets = activeTargets.filter((t) => t.recruiterId !== null);
  const achievementRate = ratedTargets.length
    ? Math.round(
        ratedTargets.reduce(
          (s, t) => s + Math.min(100, ((t.achieved ?? 0) / t.targetValue) * 100),
          0,
        ) / ratedTargets.length,
      )
    : 0;

  const openAdd = () => {
    setForm(emptyForm);
    setRecruiterSearch("");
    setRecruiterPickerOpen(false);
    setEditId(null);
    setEditStatus(null);
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
    // Pre-fill the search box label so the admin can see who they're
    // editing, but keep the picker closed (it's locked on edit anyway).
    setRecruiterSearch(
      t.recruiter ? `${t.recruiter.firstName} ${t.recruiter.lastName}` : "Global Default",
    );
    setRecruiterPickerOpen(false);
    setEditId(t.id);
    // Capture the row's status — drives whether effectiveFrom is editable.
    setEditStatus(t.effectiveStatus ?? null);
    setModal("edit");
  };
  /**
   * §23.9 — Clone: pre-fill the Add modal from an existing target with a
   * fresh effectiveFrom (today) and cleared effectiveTo. Common workflow
   * when admin renews monthly targets each cycle without retyping every
   * field. Modal stays in "add" mode so a new row is created (the original
   * is not modified).
   */
  const openClone = (t: Target) => {
    const today = new Date().toISOString().slice(0, 10);
    setForm({
      recruiterId: t.recruiterId,
      targetType: t.targetType,
      targetValue: String(t.targetValue),
      effectiveFrom: today,
      effectiveTo: "",
    });
    setRecruiterSearch(
      t.recruiter ? `${t.recruiter.firstName} ${t.recruiter.lastName}` : "",
    );
    setRecruiterPickerOpen(false);
    setEditId(null);
    setEditStatus(null);
    setModal("add");
  };

  const isGlobalDefault = form.recruiterId === null;

  const toggleGlobalDefault = () => {
    if (isGlobalDefault) {
      // Switching back to per-recruiter — clear selection
      setForm({ ...form, recruiterId: "" });
      setRecruiterSearch("");
    } else {
      // Switching to global default
      setForm({ ...form, recruiterId: null });
      setRecruiterSearch("");
      setRecruiterPickerOpen(false);
    }
  };

  const handleSave = async () => {
    const raw = {
      recruiterId: form.recruiterId === "" ? null : form.recruiterId,
      targetType: form.targetType,
      targetValue: Number(form.targetValue),
      effectiveFrom: form.effectiveFrom,
      effectiveTo: form.effectiveTo || undefined,
    };
    const parsed = targetSchema.safeParse(raw);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Validation failed");
      return;
    }
    try {
      if (modal === "add") {
        await createTarget({
          recruiterId: parsed.data.recruiterId,
          targetType: parsed.data.targetType,
          targetValue: parsed.data.targetValue,
          effectiveFrom: parsed.data.effectiveFrom,
          ...(parsed.data.effectiveTo ? { effectiveTo: parsed.data.effectiveTo } : {}),
        });
        toast.success(
          parsed.data.recruiterId === null
            ? "Global default target created"
            : "Target created",
        );
      } else if (editId) {
        // effectiveFrom is only included when the row is SCHEDULED. The
        // backend service rejects the change otherwise — sending it for
        // an ACTIVE/EXPIRED row would surface a 409 instead of being
        // silently dropped.
        await updateTarget(editId, {
          targetValue: parsed.data.targetValue,
          effectiveTo: parsed.data.effectiveTo ?? null,
          ...(editStatus === "SCHEDULED" && {
            effectiveFrom: parsed.data.effectiveFrom,
          }),
        });
        toast.success("Target updated");
      }
      setModal(null);
      void fetchData();
    } catch (err: unknown) {
      // Surface backend overlap / date errors verbatim — they have
      // actionable details (e.g. which existing target conflicts).
      const message =
        err && typeof err === "object" && "message" in err && typeof err.message === "string"
          ? err.message
          : "Failed to save target";
      toast.error(message);
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
      cell: (t) =>
        t.recruiter ? (
          <div>
            <p className="text-text-primary font-medium">
              {t.recruiter.firstName} {t.recruiter.lastName}
            </p>
            <p className="text-text-muted text-xs">{t.recruiter.employeeId}</p>
            {/* §23.9 — Override hint: this individual is shadowing an active
                global default of the same type. Helps admin see why a
                recruiter has a different value than the org-wide policy. */}
            {t.overridesGlobalValue != null && (
              <p className="text-info-600 mt-0.5 text-[10px] font-medium uppercase tracking-wide">
                Overrides global ({t.overridesGlobalValue})
              </p>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <div className="bg-info-100 flex h-6 w-6 items-center justify-center rounded">
              <Globe size={12} className="text-info-600" />
            </div>
            <div>
              <p className="text-info-600 font-medium">Global Default</p>
              <p className="text-text-muted text-xs">Applies to all recruiters</p>
              {/* §23.9 — Suppression hint: how many recruiters bypass this
                  default with their own value. "0 of N" tells admin the
                  default is universally applied. */}
              {t.suppressedByRecruiterCount !== undefined &&
                t.suppressedByRecruiterCount > 0 && (
                  <p className="text-warning-600 mt-0.5 text-[10px] font-medium uppercase tracking-wide">
                    {t.suppressedByRecruiterCount} recruiter
                    {t.suppressedByRecruiterCount === 1 ? "" : "s"} override this
                  </p>
                )}
            </div>
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
      cell: (t) => {
        const text = t.effectiveTo
          ? new Date(t.effectiveTo).toLocaleDateString("en-IN")
          : "Ongoing";
        // Days-context subtext — only meaningful when the target is in a
        // bounded, currently-relevant state. Skip for INACTIVE rows (no
        // operational meaning) and for fully ongoing future-irrelevant rows.
        const days = t.daysUntilEnd;
        let subtext: { text: string; tone: "muted" | "warning" | "danger" } | null = null;
        if (t.effectiveStatus === "ACTIVE" && days !== null && days !== undefined) {
          if (days <= 0) subtext = { text: "ends today", tone: "warning" };
          else if (days <= 7) subtext = { text: `ends in ${days}d`, tone: "warning" };
          else subtext = { text: `${days}d left`, tone: "muted" };
        } else if (t.effectiveStatus === "EXPIRED" && days !== null && days !== undefined) {
          subtext = { text: `expired ${Math.abs(days)}d ago`, tone: "danger" };
        } else if (t.effectiveStatus === "SCHEDULED" && t.daysUntilStart != null) {
          subtext = { text: `starts in ${t.daysUntilStart}d`, tone: "muted" };
        }
        const toneClass =
          subtext?.tone === "danger"
            ? "text-error-500"
            : subtext?.tone === "warning"
              ? "text-warning-500"
              : "text-text-muted";
        return (
          <div>
            <span className="text-text-secondary">{text}</span>
            {subtext && <p className={`text-xs ${toneClass}`}>{subtext.text}</p>}
          </div>
        );
      },
    },
    {
      key: "effectiveStatus",
      header: "Status",
      cell: (t) => {
        // Falls back to deriving locally if the backend hasn't been redeployed
        // (defensive — should always be present once Phase 1 ships).
        const status =
          t.effectiveStatus ??
          (!t.isActive
            ? "INACTIVE"
            : new Date(t.effectiveFrom) > new Date()
              ? "SCHEDULED"
              : t.effectiveTo && new Date(t.effectiveTo) < new Date()
                ? "EXPIRED"
                : "ACTIVE");
        const variant =
          status === "ACTIVE"
            ? "success"
            : status === "SCHEDULED"
              ? "info"
              : status === "EXPIRED"
                ? "warning"
                : "default";
        const label =
          status === "ACTIVE"
            ? "Active"
            : status === "SCHEDULED"
              ? "Scheduled"
              : status === "EXPIRED"
                ? "Expired"
                : "Inactive";
        return <Badge variant={variant}>{label}</Badge>;
      },
    },
    {
      key: "achieved",
      header: "Achievement",
      cell: (t) => {
        // Global defaults apply to multiple recruiters — there is no
        // single number, so the column shows a dash instead of a fake bar.
        if (t.recruiterId === null) {
          return <span className="text-text-muted text-xs">—</span>;
        }
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
          <Tooltip content="Clone target (same value, fresh dates)">
            <IconButton
              icon={Copy}
              aria-label="Clone target"
              size="sm"
              variant="ghost"
              onClick={() => openClone(t)}
            />
          </Tooltip>
          <Tooltip content="View change history">
            <IconButton
              icon={History}
              aria-label="View target history"
              size="sm"
              variant="ghost"
              onClick={() => setHistoryTarget(t)}
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
    (t: Target) => {
      const isGlobal = t.recruiterId === null;
      return (
        <Card padding="sm" className="transition-shadow hover:shadow-md">
          <div className="space-y-3">
            <div className="flex items-start justify-between">
              <div>
                {isGlobal ? (
                  <div className="flex items-center gap-2">
                    <Globe size={14} className="text-info-600" />
                    <p className="text-info-600 font-medium">Global Default</p>
                  </div>
                ) : (
                  <>
                    <p className="text-text-primary font-medium">
                      {t.recruiter?.firstName} {t.recruiter?.lastName}
                    </p>
                    <p className="text-text-muted text-xs">{t.recruiter?.employeeId}</p>
                  </>
                )}
                {/* §23.9 — Override hints (same as table cell, see column def) */}
                {t.overridesGlobalValue != null && (
                  <p className="text-info-600 mt-0.5 text-[10px] font-medium uppercase tracking-wide">
                    Overrides global ({t.overridesGlobalValue})
                  </p>
                )}
                {isGlobal &&
                  t.suppressedByRecruiterCount !== undefined &&
                  t.suppressedByRecruiterCount > 0 && (
                    <p className="text-warning-600 mt-0.5 text-[10px] font-medium uppercase tracking-wide">
                      {t.suppressedByRecruiterCount} recruiter
                      {t.suppressedByRecruiterCount === 1 ? "" : "s"} override this
                    </p>
                  )}
              </div>
              <Badge variant={TYPE_BADGE_VARIANT[t.targetType]}>{t.targetType}</Badge>
            </div>
            {isGlobal ? (
              <div className="text-text-secondary text-sm">
                Target value:{" "}
                <span className="text-text-primary font-semibold">{t.targetValue}</span>
              </div>
            ) : (
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
            )}
            <div className="border-border-default flex items-center justify-between border-t pt-2 text-xs">
              <span className="text-text-muted">
                {new Date(t.effectiveFrom).toLocaleDateString("en-IN")} —{" "}
                {t.effectiveTo ? new Date(t.effectiveTo).toLocaleDateString("en-IN") : "Ongoing"}
              </span>
              {(() => {
                const status = t.effectiveStatus ?? (t.isActive ? "ACTIVE" : "INACTIVE");
                const variant =
                  status === "ACTIVE"
                    ? "success"
                    : status === "SCHEDULED"
                      ? "info"
                      : status === "EXPIRED"
                        ? "warning"
                        : "default";
                const label =
                  status === "ACTIVE"
                    ? "Active"
                    : status === "SCHEDULED"
                      ? "Scheduled"
                      : status === "EXPIRED"
                        ? "Expired"
                        : "Inactive";
                return (
                  <Badge variant={variant} size="sm">
                    {label}
                  </Badge>
                );
              })()}
            </div>
          </div>
        </Card>
      );
    },
    [],
  );

  const detailRenderer = useCallback(
    (t: Target) => {
      const isGlobal = t.recruiterId === null;
      const rows: [string, string][] = [
        ["Type", t.targetType],
        ["Target Value", String(t.targetValue)],
      ];
      if (!isGlobal) {
        rows.push(["Achieved", String(t.achieved ?? 0)]);
        rows.push([
          "Achievement %",
          `${Math.min(100, Math.round(((t.achieved ?? 0) / t.targetValue) * 100))}%`,
        ]);
      }
      rows.push(["Effective From", new Date(t.effectiveFrom).toLocaleDateString("en-IN")]);
      rows.push([
        "Effective To",
        t.effectiveTo ? new Date(t.effectiveTo).toLocaleDateString("en-IN") : "Ongoing",
      ]);
      // Show the derived status so the detail panel matches the table.
      // Falls back to raw isActive if backend hasn't redeployed yet.
      const derivedStatus =
        t.effectiveStatus ??
        (!t.isActive
          ? "INACTIVE"
          : new Date(t.effectiveFrom) > new Date()
            ? "SCHEDULED"
            : t.effectiveTo && new Date(t.effectiveTo) < new Date()
              ? "EXPIRED"
              : "ACTIVE");
      rows.push([
        "Status",
        derivedStatus === "ACTIVE"
          ? "Active"
          : derivedStatus === "SCHEDULED"
            ? "Scheduled"
            : derivedStatus === "EXPIRED"
              ? "Expired"
              : "Inactive",
      ]);
      // Show the raw DB flag separately when it diverges from the derived
      // status — helps admin understand why a SCHEDULED row is still
      // "isActive=true" in the DB (it's enabled, just future-dated).
      const rawStatusName = t.isActive ? "ACTIVE" : "INACTIVE";
      if (derivedStatus !== rawStatusName) {
        rows.push(["Raw DB Flag", t.isActive ? "isActive=true" : "isActive=false"]);
      }
      // §23.9 — Override relationship in detail panel
      if (t.overridesGlobalValue != null) {
        rows.push(["Overrides Global", `${t.overridesGlobalValue} (default value)`]);
      }
      if (isGlobal && t.suppressedByRecruiterCount !== undefined) {
        rows.push([
          "Suppressed By",
          t.suppressedByRecruiterCount === 0
            ? "No individual overrides — applies universally"
            : `${t.suppressedByRecruiterCount} recruiter${
                t.suppressedByRecruiterCount === 1 ? "" : "s"
              } use their own value instead`,
        ]);
      }

      return (
        <div className="space-y-4">
          <div>
            {isGlobal ? (
              <div className="flex items-center gap-2">
                <Globe size={18} className="text-info-600" />
                <p className="text-info-600 text-lg font-semibold">Global Default</p>
              </div>
            ) : (
              <>
                <p className="text-text-primary text-lg font-semibold">
                  {t.recruiter?.firstName} {t.recruiter?.lastName}
                </p>
                <p className="text-text-muted text-sm">{t.recruiter?.employeeId}</p>
              </>
            )}
          </div>
          <div className="border-border-default divide-border-default divide-y rounded-lg border">
            {rows.map(([label, value]) => (
              <div key={label} className="flex justify-between px-4 py-2.5 text-sm">
                <span className="text-text-muted">{label}</span>
                <span className="text-text-primary font-medium">{value}</span>
              </div>
            ))}
          </div>
          {isGlobal && (
            <p className="text-text-muted text-xs">
              This is a global default applied to every recruiter who does not have an individual{" "}
              {t.targetType.toLowerCase()} target.
            </p>
          )}
        </div>
      );
    },
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
            { value: "", label: "All Statuses" },
            { value: "ACTIVE", label: "Active" },
            { value: "SCHEDULED", label: "Scheduled (future)" },
            { value: "EXPIRED", label: "Expired" },
            { value: "INACTIVE", label: "Inactive" },
            { value: "ENDING_SOON", label: "Ending Soon (≤7d)" },
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
        detailTitle={(t) =>
          t.recruiter
            ? `${t.recruiter.firstName} ${t.recruiter.lastName} — ${t.targetType}`
            : `Global Default — ${t.targetType}`
        }
        enableKeyboardNav
        onExport={() => {
          exportToXLSX(
            targets,
            [
              {
                header: "Recruiter",
                accessor: (t) =>
                  t.recruiter
                    ? `${t.recruiter.firstName} ${t.recruiter.lastName}`
                    : "Global Default",
              },
              { header: "Employee ID", accessor: (t) => t.recruiter?.employeeId ?? "—" },
              { header: "Type", accessor: (t) => t.targetType },
              { header: "Target Value", accessor: (t) => t.targetValue },
              {
                header: "Achieved",
                accessor: (t) => (t.recruiterId === null ? "—" : (t.achieved ?? 0)),
              },
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
                  ? // Add: must have recruiter (or explicitly global default) + value + start date
                    (form.recruiterId !== null && !form.recruiterId) ||
                    !form.targetValue ||
                    !form.effectiveFrom
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
            <>
              {/* Recruiter / Global default toggle */}
              <FormField label="Apply To" required>
                <div className="space-y-2">
                  {/* Global default toggle button */}
                  <button
                    type="button"
                    onClick={toggleGlobalDefault}
                    className={cn(
                      "border-border-default flex w-full items-center gap-3 rounded-md border px-3 py-2 text-left transition-colors",
                      isGlobalDefault
                        ? "border-info-500 bg-info-50"
                        : "hover:border-border-hover",
                    )}
                  >
                    <div
                      className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-md",
                        isGlobalDefault ? "bg-info-100" : "bg-bg-muted",
                      )}
                    >
                      <Globe
                        size={14}
                        className={isGlobalDefault ? "text-info-600" : "text-text-muted"}
                      />
                    </div>
                    <div className="flex-1">
                      <p className="text-text-primary text-sm font-medium">
                        Global Default
                      </p>
                      <p className="text-text-muted text-xs">
                        Applies to every recruiter without an individual override
                      </p>
                    </div>
                    {isGlobalDefault && (
                      <Badge variant="info" size="sm">
                        Selected
                      </Badge>
                    )}
                  </button>

                  {/* Recruiter picker — disabled while in global default mode */}
                  {!isGlobalDefault && (
                    <div className="relative" ref={recruiterPickerRef}>
                      <div className="relative">
                        <Search
                          size={14}
                          className="text-text-muted absolute top-1/2 left-3 -translate-y-1/2"
                        />
                        <Input
                          value={recruiterSearch}
                          onChange={(e) => {
                            setRecruiterSearch(e.target.value);
                            setRecruiterPickerOpen(true);
                            // Clear selection if the user is typing again
                            if (form.recruiterId) {
                              setForm({ ...form, recruiterId: "" });
                            }
                          }}
                          onFocus={() => setRecruiterPickerOpen(true)}
                          placeholder="Search recruiters..."
                          className="pl-8 pr-8"
                        />
                        {form.recruiterId && (
                          <button
                            type="button"
                            onClick={() => {
                              setForm({ ...form, recruiterId: "" });
                              setRecruiterSearch("");
                              setRecruiterPickerOpen(false);
                            }}
                            className="text-text-muted hover:text-text-primary absolute top-1/2 right-2 -translate-y-1/2"
                            aria-label="Clear recruiter selection"
                          >
                            <X size={14} />
                          </button>
                        )}
                      </div>
                      {recruiterPickerOpen && recruiterSearch && !form.recruiterId && (
                        <div className="border-border-default bg-bg-surface absolute z-10 mt-1 max-h-32 w-full overflow-y-auto rounded-md border shadow-lg">
                          {filteredRecruiters.length === 0 ? (
                            <div className="text-text-muted px-3 py-2 text-sm">
                              No matching recruiters
                            </div>
                          ) : (
                            filteredRecruiters.map((r) => (
                              <button
                                key={r.id}
                                type="button"
                                onClick={() => {
                                  // §23.9 fix #9: closing the dropdown after pick
                                  setForm({ ...form, recruiterId: r.id });
                                  setRecruiterSearch(`${r.firstName} ${r.lastName}`);
                                  setRecruiterPickerOpen(false);
                                }}
                                className="hover:bg-bg-hover block w-full px-3 py-1.5 text-left text-sm"
                              >
                                {r.firstName} {r.lastName}{" "}
                                <span className="text-text-muted">({r.employeeId})</span>
                              </button>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </FormField>

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
            </>
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
            <FormField
              label="Effective From"
              required
              htmlFor="effective-from"
              // §23.9 — Once a target starts, its start date is locked
              // (changing it would invalidate achievement-window math).
              // SCHEDULED rows can still be edited.
              helpText={
                modal === "edit" && editStatus && editStatus !== "SCHEDULED"
                  ? "Locked — start date can only be edited while target is Scheduled"
                  : undefined
              }
            >
              <DatePicker
                id="effective-from"
                value={form.effectiveFrom}
                onChange={(value) => setForm({ ...form, effectiveFrom: value })}
                disabled={modal === "edit" && editStatus !== "SCHEDULED"}
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

      {/* §23.9 — Per-target audit history modal */}
      <TargetHistoryModal target={historyTarget} onClose={() => setHistoryTarget(null)} />
    </div>
  );
}

// ──────────────────────────────────────────────
//  TargetHistoryModal — §23.9 + §23.1
//
//  Renders the audit-log timeline for a single target row. Reads from
//  GET /targets/:id/history which is backed by the existing audit_logs
//  table filtered by entityType=RecruiterTarget.
// ──────────────────────────────────────────────

function formatChangeValue(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "string") {
    // Heuristic: ISO-looking date strings → human format
    if (/^\d{4}-\d{2}-\d{2}T/.test(v)) {
      const d = new Date(v);
      if (!Number.isNaN(d.getTime())) return d.toLocaleDateString("en-IN");
    }
    return v;
  }
  return String(v);
}

const FIELD_LABELS: Record<string, string> = {
  targetValue: "Target value",
  effectiveFrom: "Effective from",
  effectiveTo: "Effective to",
  isActive: "Active flag",
  recruiterId: "Recruiter",
  targetType: "Type",
};

function TargetHistoryModal({
  target,
  onClose,
}: {
  target: Target | null;
  onClose: () => void;
}) {
  const open = target !== null;
  const historyQuery = useQuery({
    queryKey: ["target-history", target?.id] as const,
    queryFn: async (): Promise<TargetHistoryEntry[]> => {
      if (!target) return [];
      return getTargetHistory(target.id);
    },
    enabled: open && !!target,
  });
  const history = historyQuery.data ?? [];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        target
          ? `History — ${
              target.recruiter
                ? `${target.recruiter.firstName} ${target.recruiter.lastName} · ${target.targetType}`
                : `Global Default · ${target.targetType}`
            }`
          : "History"
      }
      size="lg"
    >
      {historyQuery.isLoading ? (
        <p className="text-text-muted text-sm">Loading history…</p>
      ) : history.length === 0 ? (
        <div className="py-8 text-center">
          <History size={28} className="text-text-muted mx-auto mb-2" />
          <p className="text-text-secondary text-sm">No changes recorded yet.</p>
          <p className="text-text-muted mt-1 text-xs">
            Audit logging started after the target system overhaul. Earlier targets show no history.
          </p>
        </div>
      ) : (
        <div className="relative space-y-0">
          {/* Vertical timeline rail */}
          <div className="bg-border-default absolute top-2 bottom-2 left-3 w-px" />
          {history.map((entry, idx) => {
            const variant =
              entry.action === "CREATE"
                ? "success"
                : entry.action === "DELETE"
                  ? "warning"
                  : "info";
            return (
              <div key={entry.id} className="relative flex items-start gap-4 pb-5">
                <div
                  className={cn(
                    "ring-bg-surface relative z-10 mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ring-2",
                    idx === 0 ? "bg-primary-500" : "bg-border-default",
                  )}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={variant} size="sm">
                      {entry.action}
                    </Badge>
                    <span className="text-text-muted text-xs">
                      {new Date(entry.timestamp).toLocaleString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    {entry.user && (
                      <span className="text-text-muted text-xs">
                        by {entry.user.firstName} {entry.user.lastName}
                        {entry.user.employeeId ? ` (${entry.user.employeeId})` : ""}
                      </span>
                    )}
                  </div>
                  {entry.changes && Object.keys(entry.changes).length > 0 && (
                    <div className="border-border-default mt-2 space-y-1.5 rounded-md border p-3 text-xs">
                      {Object.entries(entry.changes).map(([field, change]) => (
                        <div key={field} className="flex items-center gap-2">
                          <span className="text-text-muted w-28 shrink-0">
                            {FIELD_LABELS[field] ?? field}
                          </span>
                          <span className="text-text-secondary line-through">
                            {formatChangeValue(change.old)}
                          </span>
                          <ArrowRight size={11} className="text-text-muted shrink-0" />
                          <span className="text-text-primary font-medium">
                            {formatChangeValue(change.new)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
}
