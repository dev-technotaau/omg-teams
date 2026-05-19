"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useClickOutside } from "@/hooks";
import { useMutation, useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { qk } from "@/lib/query-keys";
import { toastApiError } from "@/lib/query-helpers";
import Link from "next/link";
import Image from "next/image";
import DOMPurify from "isomorphic-dompurify";
import {
  Plus,
  FileText,
  Archive,
  Eye,
  Download,
  FileOutput,
  FileSearch,
  Settings,
  Pen,
  Users,
  CheckCircle,
  Archive as ArchiveIcon,
} from "lucide-react";
import { toast } from "sonner";
import {
  listOfferLetters,
  createOfferLetter,
  archiveOfferLetter,
  generateOfferLetterPdf,
  previewOfferLetterPdf,
  type OfferLetter,
} from "@/services/offer-letter.service";
import { api } from "@/lib/api";
import {
  PageHeader,
  Card,
  Badge,
  Button,
  Modal,
  FormField,
  Input,
  Select,
  TimePicker,
  DataTable,
  IconButton,
  ConfirmDialog,
  Tooltip,
} from "@/components/ui";
import { CalendarDatePicker } from "@/components/ui/calendar-date-picker";
import type { Column, ViewType, RowDensity } from "@/components/ui";
import { TiptapEditor } from "@/components/tiptap-editor";
import { cn } from "@/lib/utils";
import { pluralize } from "@/utils/format";

// ──────────────────────────────────────────────
//  Admin Offer Letters — Spec Section 29.4
// ──────────────────────────────────────────────

// §29.4 — Work mode codes. The same value is sent to the backend, which
// renders the long form next to the position title and the short code in
// section 3 of the offer letter.
const WORK_MODE_OPTIONS = [
  { value: "WFH", label: "Work From Home" },
  { value: "WFO", label: "Work From Office" },
  { value: "HYBRID", label: "Hybrid" },
];

const WEEKDAY_OPTIONS = [
  { value: "Sunday", label: "Sunday" },
  { value: "Monday", label: "Monday" },
  { value: "Tuesday", label: "Tuesday" },
  { value: "Wednesday", label: "Wednesday" },
  { value: "Thursday", label: "Thursday" },
  { value: "Friday", label: "Friday" },
  { value: "Saturday", label: "Saturday" },
];

// §29.4 — Last-used defaults persist in localStorage so the next offer
// letter pre-fills with whatever the admin picked previously. Pure
// client-side; no backend roundtrip.
const OFFER_LETTER_DEFAULTS_KEY = "offer-letter-defaults-v1";
type OfferLetterDefaults = {
  workMode: string;
  officeStartTime: string;
  officeEndTime: string;
  weeklyOffs: string[];
};
const FACTORY_DEFAULTS: OfferLetterDefaults = {
  workMode: "WFH",
  officeStartTime: "10:00",
  officeEndTime: "18:00",
  weeklyOffs: ["Sunday"],
};
function loadOfferLetterDefaults(): OfferLetterDefaults {
  if (typeof window === "undefined") return FACTORY_DEFAULTS;
  try {
    const raw = window.localStorage.getItem(OFFER_LETTER_DEFAULTS_KEY);
    if (!raw) return FACTORY_DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<OfferLetterDefaults>;
    return {
      workMode: parsed.workMode ?? FACTORY_DEFAULTS.workMode,
      officeStartTime: parsed.officeStartTime ?? FACTORY_DEFAULTS.officeStartTime,
      officeEndTime: parsed.officeEndTime ?? FACTORY_DEFAULTS.officeEndTime,
      weeklyOffs:
        Array.isArray(parsed.weeklyOffs) && parsed.weeklyOffs.length > 0
          ? parsed.weeklyOffs
          : FACTORY_DEFAULTS.weeklyOffs,
    };
  } catch {
    return FACTORY_DEFAULTS;
  }
}
function saveOfferLetterDefaults(d: OfferLetterDefaults): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(OFFER_LETTER_DEFAULTS_KEY, JSON.stringify(d));
  } catch {
    /* quota / private mode — non-fatal */
  }
}

interface UserOption {
  id: string;
  firstName: string;
  lastName: string;
  employeeId: string | null;
  email: string;
}

/**
 * Inline searchable employee picker. Shows a read-only pill when a user is
 * selected (with a "Change" action), otherwise a search input with a
 * dropdown of matches. Self-contained state — each instance owns its own
 * search string so one variant's picker doesn't affect the other.
 */
function EmployeePicker({
  selected,
  onSelect,
  onClear,
  placeholder,
  id,
}: {
  selected: UserOption | null;
  onSelect: (user: UserOption) => void;
  onClear: () => void;
  placeholder: string;
  id?: string;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserOption[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  // Dismiss the search-results dropdown when the user clicks elsewhere
  // (without picking a row) so it doesn't stay floating over the form.
  useClickOutside(containerRef, () => {
    if (results.length > 0) setResults([]);
  });

  useEffect(() => {
    if (query.length < 2) {
      // reason: clearing transient debounced search results when query too short
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResults([]);
      return;
    }
    const t = setTimeout(() => {
      void api
        .get<{ data: UserOption[] }>("/users", { params: { search: query, limit: "10" } })
        .then((res) => setResults(res.data.data))
        .catch(() => {
          /* silent */
        });
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  if (selected) {
    return (
      <div className="border-border-default bg-bg-input flex items-center justify-between rounded-md border px-3 py-2">
        <span className="text-text-primary text-sm">
          {selected.firstName} {selected.lastName} ({selected.email})
        </span>
        <button
          type="button"
          onClick={() => {
            onClear();
            setQuery("");
            setResults([]);
          }}
          className="text-error-500 text-xs"
        >
          Change
        </button>
      </div>
    );
  }

  return (
    <div className="relative" ref={containerRef}>
      <Input
        id={id}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
      />
      {results.length > 0 && (
        <div className="border-border-default bg-bg-surface-raised absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-md border shadow-lg">
          {results.map((u) => (
            <button
              key={u.id}
              type="button"
              onClick={() => {
                onSelect(u);
                setQuery("");
                setResults([]);
              }}
              className="hover:bg-bg-hover flex w-full items-center justify-between px-3 py-2 text-left text-sm"
            >
              <span className="text-text-primary">
                {u.firstName} {u.lastName}
              </span>
              <span className="text-text-muted text-xs">{u.email}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const VARIANT_OPTIONS = [
  {
    value: "TEMPLATE",
    label: "Template (Static + Dynamic)",
    desc: "Pre-built template with dynamic field placeholders",
  },
  {
    value: "TIPTAP_EDITOR",
    label: "Rich Text Editor (Tiptap)",
    desc: "Full custom content with rich text editor",
  },
] as const;

// §29.4 — Initial dynamicFields seeded from the persisted last-used
// defaults so a fresh form already shows the admin's previous picks for
// timing, weekly offs, and work mode.
function buildEmptyForm() {
  const defaults = loadOfferLetterDefaults();
  return {
    userId: "",
    variant: "TEMPLATE" as string,
    dynamicFields: {
      workMode: defaults.workMode,
      officeStartTime: defaults.officeStartTime,
      officeEndTime: defaults.officeEndTime,
      weeklyOffs: defaults.weeklyOffs,
    } as Record<string, string | string[]>,
    editorContent: "",
  };
}
const emptyForm = buildEmptyForm();

export default function AdminOfferLettersPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState<"create" | "view" | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [viewLetter, setViewLetter] = useState<OfferLetter | null>(null);
  const [archiveId, setArchiveId] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<UserOption | null>(null);
  const [viewType, setViewType] = useState<ViewType>("table");
  const [density, setDensity] = useState<RowDensity>("default");
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set());

  // Signatory config preview
  const [signatoryName, setSignatoryName] = useState("Shalini Singh");
  const [signatoryTitle, setSignatoryTitle] = useState("HR Manager");
  const [signatoryImageUrl, setSignatoryImageUrl] = useState<string | null>(null);

  const fetchSignatoryConfig = useCallback(async () => {
    try {
      const [nameRes, titleRes, urlRes] = await Promise.all([
        api.get<{ setting: { value: unknown } | null }>("/settings/offer_letter_signatory_name"),
        api.get<{ setting: { value: unknown } | null }>("/settings/offer_letter_signatory_title"),
        api.get<{ setting: { value: unknown } | null }>("/settings/offer_letter_signature_url"),
      ]);
      if (nameRes.data.setting?.value) setSignatoryName(String(nameRes.data.setting.value));
      if (titleRes.data.setting?.value) setSignatoryTitle(String(titleRes.data.setting.value));
      if (urlRes.data.setting?.value) setSignatoryImageUrl(String(urlRes.data.setting.value));
    } catch {
      /* use defaults */
    }
  }, []);

  // Server state — paginated list. `placeholderData: keepPreviousData` keeps
  // the prior page visible during pagination (no skeleton flash).
  const lettersQuery = useQuery({
    queryKey: qk.offerLetters.list({ page }),
    queryFn: () => listOfferLetters({ page, limit: 20 }),
    placeholderData: keepPreviousData,
  });
  const letters = useMemo(() => lettersQuery.data?.data ?? [], [lettersQuery.data]);
  const pagination = lettersQuery.data?.pagination ?? { page: 1, totalPages: 1, total: 0 };
  const isLoading = lettersQuery.isLoading;

  // Signatory config — separate query so it caches independently.
  useQuery({
    queryKey: [...qk.offerLetters.all(), "signatory-config"] as const,
    queryFn: async () => {
      await fetchSignatoryConfig();
      return null;
    },
    staleTime: 10 * 60 * 1000, // settings rarely change
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: qk.offerLetters.lists() });

  const stats = useMemo(() => {
    const total = pagination.total;
    const active = letters.filter((l) => !l.isArchived).length;
    const archived = letters.filter((l) => l.isArchived).length;
    const template = letters.filter((l) => l.variant === "TEMPLATE").length;
    return { total, active, archived, template };
  }, [letters, pagination.total]);

  // ── Mutations ──
  const createMutation = useMutation({
    mutationFn: createOfferLetter,
    onSuccess: () => {
      toast.success("Offer letter created");
      setModal(null);
      void invalidate();
    },
    onError: (err) => toastApiError(err, "Failed to create offer letter"),
  });

  const archiveMutation = useMutation({
    mutationFn: archiveOfferLetter,
    onMutate: async (id: string) => {
      const key = qk.offerLetters.list({ page });
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<typeof lettersQuery.data>(key);
      qc.setQueryData(key, (old: typeof lettersQuery.data | undefined) =>
        old
          ? {
              ...old,
              data: old.data.map((l) => (l.id === id ? { ...l, isArchived: true } : l)),
            }
          : old,
      );
      return { prev, key };
    },
    onError: (err, _id, ctx) => {
      if (ctx) qc.setQueryData(ctx.key, ctx.prev);
      toastApiError(err, "Failed to archive");
    },
    onSuccess: () => {
      toast.success("Offer letter archived");
      setArchiveId(null);
    },
    onSettled: () => void invalidate(),
  });

  const saving = createMutation.isPending;

  const openCreate = () => {
    // Rebuild from localStorage so the latest persisted defaults win even
    // after the first openCreate of the session.
    setForm(buildEmptyForm());
    setSelectedUser(null);
    setModal("create");
  };
  const openView = (letter: OfferLetter) => {
    setViewLetter(letter);
    setModal("view");
  };

  const handleGeneratePdf = async (letter: OfferLetter) => {
    try {
      toast.loading("Generating PDF...", { id: "gen-pdf" });
      const { fileUrl } = await generateOfferLetterPdf(letter.id);
      toast.success("PDF generated, downloading...", { id: "gen-pdf" });
      void invalidate();

      // Fetch the freshly-generated file and trigger a browser download
      try {
        const res = await fetch(fileUrl);
        if (!res.ok) throw new Error("fetch failed");
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const safeName = `${letter.referenceNumber}${
          letter.user ? `-${letter.user.firstName}-${letter.user.lastName}` : ""
        }.pdf`.replace(/\s+/g, "_");
        const a = document.createElement("a");
        a.href = url;
        a.download = safeName;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      } catch {
        toast.error("PDF generated but download failed — use the download button", {
          id: "gen-pdf",
        });
      }
    } catch {
      toast.error("Failed to generate PDF", { id: "gen-pdf" });
    }
  };

  const handlePreviewPdf = async (id: string) => {
    try {
      toast.loading("Loading preview...", { id: "preview-pdf" });
      const blobUrl = await previewOfferLetterPdf(id);
      window.open(blobUrl, "_blank");
      toast.dismiss("preview-pdf");
    } catch {
      toast.error("Failed to preview PDF", { id: "preview-pdf" });
    }
  };

  const handleDownloadPdf = async (letter: OfferLetter) => {
    if (!letter.generatedFileUrl) return;
    try {
      const res = await fetch(letter.generatedFileUrl);
      if (!res.ok) throw new Error("fetch failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const safeName = `${letter.referenceNumber}${
        letter.user ? `-${letter.user.firstName}-${letter.user.lastName}` : ""
      }.pdf`.replace(/\s+/g, "_");
      const a = document.createElement("a");
      a.href = url;
      a.download = safeName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Failed to download PDF");
    }
  };

  const handleCreate = () => {
    if (!form.userId) {
      toast.error("Please select an employee");
      return;
    }
    // §29.4 — Persist the timing/work-mode/weekly-offs picks so the next
    // form open pre-fills with the same choices.
    if (form.variant === "TEMPLATE") {
      const df = form.dynamicFields;
      saveOfferLetterDefaults({
        workMode: String(df["workMode"] ?? FACTORY_DEFAULTS.workMode),
        officeStartTime: String(df["officeStartTime"] ?? FACTORY_DEFAULTS.officeStartTime),
        officeEndTime: String(df["officeEndTime"] ?? FACTORY_DEFAULTS.officeEndTime),
        weeklyOffs: Array.isArray(df["weeklyOffs"])
          ? (df["weeklyOffs"] as string[])
          : FACTORY_DEFAULTS.weeklyOffs,
      });
    }
    createMutation.mutate({
      userId: form.userId,
      variant: form.variant,
      ...(form.variant === "TEMPLATE"
        ? { dynamicFields: form.dynamicFields }
        : { editorContent: form.editorContent }),
    });
  };

  const handleArchive = () => {
    if (!archiveId) return;
    archiveMutation.mutate(archiveId);
  };

  const columns: Column<OfferLetter>[] = [
    {
      key: "referenceNumber",
      header: "Reference",
      cell: (l) => <span className="text-text-primary font-mono text-xs">{l.referenceNumber}</span>,
    },
    {
      key: "user",
      header: "Employee",
      cell: (l) => (
        <div>
          <div className="text-text-primary font-medium">
            {l.user.firstName} {l.user.lastName}
          </div>
          <div className="text-text-muted text-xs">{l.user.email}</div>
        </div>
      ),
    },
    {
      key: "variant",
      header: "Variant",
      cell: (l) => <Badge variant="default">{l.variant}</Badge>,
    },
    {
      key: "status",
      header: "Status",
      cell: (l) => {
        const isArchived = l.isArchived;
        return (
          <Badge variant={isArchived ? "default" : "success"}>
            {isArchived ? "archived" : "active"}
          </Badge>
        );
      },
    },
    {
      key: "createdAt",
      header: "Created",
      cell: (l) =>
        new Date(l.createdAt).toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        }),
    },
    {
      key: "actions",
      header: "Actions",
      cell: (l) => (
        <div className="flex gap-1">
          <Tooltip content="View">
            <IconButton icon={Eye} aria-label="View" size="xs" onClick={() => openView(l)} />
          </Tooltip>
          {!l.isArchived && (
            <Tooltip content="Preview PDF">
              <IconButton
                icon={FileSearch}
                aria-label="Preview PDF"
                size="xs"
                variant="ghost"
                className="text-info-500 hover:bg-info-100"
                onClick={() => void handlePreviewPdf(l.id)}
              />
            </Tooltip>
          )}
          {!l.generatedFileUrl && !l.isArchived && (
            <Tooltip content="Generate PDF">
              <IconButton
                icon={FileOutput}
                aria-label="Generate PDF"
                size="xs"
                variant="ghost"
                className="text-primary-500 hover:bg-primary-100"
                onClick={() => void handleGeneratePdf(l)}
              />
            </Tooltip>
          )}
          {l.generatedFileUrl && (
            <Tooltip content="Download PDF">
              <IconButton
                icon={Download}
                aria-label="Download PDF"
                size="xs"
                variant="ghost"
                className="text-success-500 hover:bg-success-100"
                onClick={() => void handleDownloadPdf(l)}
              />
            </Tooltip>
          )}
          {!l.isArchived && (
            <Tooltip content="Archive">
              <IconButton
                icon={Archive}
                aria-label="Archive"
                size="xs"
                variant="ghost"
                onClick={() => setArchiveId(l.id)}
                className="text-warning-700 hover:bg-warning-100"
              />
            </Tooltip>
          )}
        </div>
      ),
    },
  ];

  const cardRenderer = useCallback(
    (l: OfferLetter) => (
      <Card
        padding="sm"
        className="cursor-pointer transition-shadow hover:shadow-md"
        onClick={() => openView(l)}
      >
        <div className="space-y-2">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-text-primary font-medium">
                {l.user.firstName} {l.user.lastName}
              </p>
              <p className="text-text-muted text-xs">{l.user.email}</p>
            </div>
            <Badge variant={l.isArchived ? "default" : "success"}>
              {l.isArchived ? "Archived" : "Active"}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-text-muted font-mono text-xs">{l.referenceNumber}</span>
            <Badge variant="default" size="sm">
              {l.variant}
            </Badge>
          </div>
          <div className="border-border-default flex items-center justify-between border-t pt-2 text-xs">
            <span className="text-text-muted">
              {new Date(l.createdAt).toLocaleDateString("en-IN", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })}
            </span>
            <div className="flex gap-1">
              {l.generatedFileUrl && (
                <Tooltip content="Download">
                  <IconButton
                    icon={Download}
                    aria-label="Download"
                    size="xs"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleDownloadPdf(l);
                    }}
                  />
                </Tooltip>
              )}
              {!l.isArchived && (
                <Tooltip content="Archive">
                  <IconButton
                    icon={Archive}
                    aria-label="Archive"
                    size="xs"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      setArchiveId(l.id);
                    }}
                  />
                </Tooltip>
              )}
            </div>
          </div>
        </div>
      </Card>
    ),
    [],
  );

  const offerDetailRenderer = useCallback(
    (l: OfferLetter) => (
      <div className="space-y-4">
        <div>
          <p className="text-text-primary text-lg font-semibold">
            {l.user.firstName} {l.user.lastName}
          </p>
          <p className="text-text-muted text-sm">{l.user.email}</p>
        </div>
        <div className="border-border-default divide-border-default divide-y rounded-lg border">
          {[
            ["Reference", l.referenceNumber],
            ["Variant", l.variant],
            ["Status", l.isArchived ? "Archived" : "Active"],
            ["Created", new Date(l.createdAt).toLocaleDateString("en-IN")],
          ].map(([label, value]) => (
            <div key={String(label)} className="flex justify-between px-4 py-2.5 text-sm">
              <span className="text-text-muted">{label}</span>
              <span className="text-text-primary font-medium">{value}</span>
            </div>
          ))}
        </div>
        {l.dynamicFields && Object.keys(l.dynamicFields).length > 0 && (
          <div>
            <p className="text-text-primary mb-2 text-sm font-medium">Dynamic Fields</p>
            <div className="border-border-default divide-border-default divide-y rounded-lg border">
              {Object.entries(l.dynamicFields).map(([k, v]) => (
                <div key={k} className="flex justify-between px-4 py-2 text-xs">
                  <span className="text-text-muted">{k}</span>
                  <span className="text-text-primary">{String(v)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        <button
          type="button"
          onClick={() => openView(l)}
          className="bg-primary-500 hover:bg-primary-600 block w-full rounded-md px-4 py-2 text-center text-sm font-medium text-white"
        >
          View Full Details
        </button>
      </div>
    ),
    [],
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Offer Letters"
        description={pluralize(pagination.total, "offer letter")}
        actions={
          <Button leftIcon={Plus} onClick={openCreate}>
            Generate Offer Letter
          </Button>
        }
      />

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
            <div className="bg-success-100 flex h-10 w-10 items-center justify-center rounded-lg">
              <CheckCircle size={18} className="text-success-600" />
            </div>
            <div>
              <p className="text-text-muted text-xs">Active</p>
              <p className="text-success-600 text-xl font-bold">{stats.active}</p>
            </div>
          </div>
        </Card>
        <Card padding="sm">
          <div className="flex items-center gap-3">
            <div className="bg-warning-100 flex h-10 w-10 items-center justify-center rounded-lg">
              <ArchiveIcon size={18} className="text-warning-600" />
            </div>
            <div>
              <p className="text-text-muted text-xs">Archived</p>
              <p className="text-warning-600 text-xl font-bold">{stats.archived}</p>
            </div>
          </div>
        </Card>
        <Card padding="sm">
          <div className="flex items-center gap-3">
            <div className="bg-info-100 flex h-10 w-10 items-center justify-center rounded-lg">
              <Users size={18} className="text-info-600" />
            </div>
            <div>
              <p className="text-text-muted text-xs">Template</p>
              <p className="text-info-600 text-xl font-bold">{stats.template}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={letters}
        loading={isLoading}
        emptyIcon={FileText}
        emptyTitle="No offer letters"
        emptyDescription="Generate your first offer letter to get started"
        page={pagination.page}
        totalPages={pagination.totalPages}
        total={pagination.total}
        pageSize={20}
        onPageChange={setPage}
        viewType={viewType}
        onViewTypeChange={setViewType}
        cardRenderer={cardRenderer}
        enableColumnVisibility
        density={density}
        onDensityChange={setDensity}
        pinnedIds={pinnedIds}
        onPinChange={setPinnedIds}
        detailRenderer={offerDetailRenderer}
        detailTitle={(l) => `${l.user.firstName} ${l.user.lastName} — Offer Letter`}
        enableKeyboardNav
      />

      {/* Create Modal */}
      <Modal
        open={modal === "create"}
        onClose={() => setModal(null)}
        title="Generate Offer Letter"
        size="xl"
        footer={
          <>
            <Button variant="outline" onClick={() => setModal(null)}>
              Cancel
            </Button>
            <Button loading={saving} disabled={!form.userId} onClick={() => void handleCreate()}>
              Generate
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {/* Variant Selection */}
          <FormField label="Variant">
            <div className="grid grid-cols-2 gap-3">
              {VARIANT_OPTIONS.map((v) => (
                <button
                  key={v.value}
                  onClick={() => setForm((f) => ({ ...f, variant: v.value }))}
                  className={cn(
                    "group rounded-lg border p-3 text-left transition",
                    form.variant === v.value
                      ? "border-primary-500 bg-primary-500/15"
                      : "border-border-default hover:border-border-hover",
                  )}
                >
                  <div
                    className={cn(
                      "text-sm font-medium",
                      form.variant === v.value ? "text-primary-600" : "text-text-primary",
                    )}
                  >
                    {v.label}
                  </div>
                  <div className="text-text-muted text-xs">{v.desc}</div>
                </button>
              ))}
            </div>
          </FormField>

          {/* §29.4.2 — Template variant: specific dynamic fields matching actual PDF */}
          {form.variant === "TEMPLATE" && (
            <div className="space-y-3">
              <p className="text-text-muted text-xs">
                Fields marked with * are auto-filled from the selected employee. All fields are
                editable.
              </p>

              <div className="grid grid-cols-2 gap-3">
                <FormField label="Employee *" htmlFor="ol-name">
                  <EmployeePicker
                    id="ol-name"
                    placeholder="Search employee by name or email..."
                    selected={selectedUser}
                    onSelect={(u) => {
                      setSelectedUser(u);
                      setForm((f) => ({
                        ...f,
                        userId: u.id,
                        dynamicFields: {
                          ...f.dynamicFields,
                          employeeName: `${u.firstName} ${u.lastName}`,
                        },
                      }));
                    }}
                    onClear={() => {
                      setSelectedUser(null);
                      setForm((f) => ({
                        ...f,
                        userId: "",
                        dynamicFields: { ...f.dynamicFields, employeeName: "" },
                      }));
                    }}
                  />
                </FormField>

                <FormField label="Position Title" htmlFor="ol-position">
                  <Input
                    id="ol-position"
                    value={String(form.dynamicFields["positionTitle"] ?? "")}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        dynamicFields: { ...f.dynamicFields, positionTitle: e.target.value },
                      }))
                    }
                    placeholder="e.g. Hiring Associate"
                  />
                </FormField>

                <FormField label="Work Mode" htmlFor="ol-work-mode">
                  <Select
                    id="ol-work-mode"
                    options={WORK_MODE_OPTIONS}
                    value={String(form.dynamicFields["workMode"] ?? "WFH")}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        dynamicFields: { ...f.dynamicFields, workMode: e.target.value },
                      }))
                    }
                  />
                </FormField>

                <FormField label="Date of Joining" htmlFor="ol-joining">
                  <CalendarDatePicker
                    id="ol-joining"
                    value={String(form.dynamicFields["joiningDateISO"] ?? "")}
                    onChange={(iso) => {
                      // Store ISO for the picker round-trip and a pretty
                      // display string ("23rd December 2025") for the PDF.
                      const formatted = iso
                        ? (() => {
                            const [y, m, d] = iso.split("-").map(Number);
                            if (!y || !m || !d) return iso;
                            const date = new Date(y, m - 1, d);
                            const day = date.getDate();
                            const ord =
                              day % 10 === 1 && day !== 11
                                ? "st"
                                : day % 10 === 2 && day !== 12
                                  ? "nd"
                                  : day % 10 === 3 && day !== 13
                                    ? "rd"
                                    : "th";
                            const month = date.toLocaleString("en-GB", { month: "long" });
                            return `${day}${ord} ${month} ${y}`;
                          })()
                        : "";
                      setForm((f) => ({
                        ...f,
                        dynamicFields: {
                          ...f.dynamicFields,
                          joiningDate: formatted,
                          joiningDateISO: iso,
                        },
                      }));
                    }}
                    placeholder="Select date"
                    clearable
                  />
                </FormField>

                <FormField label="Salary Amount" htmlFor="ol-salary">
                  <Input
                    id="ol-salary"
                    value={String(form.dynamicFields["salaryAmount"] ?? "")}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        dynamicFields: { ...f.dynamicFields, salaryAmount: e.target.value },
                      }))
                    }
                    placeholder="e.g. Rs. 20,000/-"
                  />
                </FormField>

                <FormField label="Probation Period" htmlFor="ol-probation">
                  <Input
                    id="ol-probation"
                    value={String(form.dynamicFields["probationPeriod"] ?? "")}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        dynamicFields: { ...f.dynamicFields, probationPeriod: e.target.value },
                      }))
                    }
                    placeholder="e.g. 2 months"
                  />
                </FormField>

                <FormField label="Notice Period" htmlFor="ol-notice">
                  <Input
                    id="ol-notice"
                    value={String(form.dynamicFields["noticePeriod"] ?? "")}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        dynamicFields: { ...f.dynamicFields, noticePeriod: e.target.value },
                      }))
                    }
                    placeholder="e.g. 15 Days"
                  />
                </FormField>
              </div>

              {/* §29.4 — Office timings & weekly offs (rendered into the
                  boilerplate section 3 of the PDF). Defaults persist in
                  localStorage and pre-fill on the next form open. */}
              <div className="border-border-default mt-2 border-t pt-3">
                <p className="text-text-muted mb-2 text-xs font-medium uppercase tracking-wider">
                  Office Timings & Leaves
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <FormField label="Start Time" htmlFor="ol-start-time">
                    <TimePicker
                      id="ol-start-time"
                      value={String(form.dynamicFields["officeStartTime"] ?? "10:00")}
                      onChange={(val) =>
                        setForm((f) => ({
                          ...f,
                          dynamicFields: { ...f.dynamicFields, officeStartTime: val },
                        }))
                      }
                      use12Hour
                    />
                  </FormField>

                  <FormField label="End Time" htmlFor="ol-end-time">
                    <TimePicker
                      id="ol-end-time"
                      value={String(form.dynamicFields["officeEndTime"] ?? "18:00")}
                      onChange={(val) =>
                        setForm((f) => ({
                          ...f,
                          dynamicFields: { ...f.dynamicFields, officeEndTime: val },
                        }))
                      }
                      use12Hour
                    />
                  </FormField>

                  <FormField label="Weekly Off (Holidays)" htmlFor="ol-weekly-offs">
                    <Select
                      id="ol-weekly-offs"
                      multiple
                      options={WEEKDAY_OPTIONS}
                      value={
                        Array.isArray(form.dynamicFields["weeklyOffs"])
                          ? (form.dynamicFields["weeklyOffs"] as string[])
                          : ["Sunday"]
                      }
                      onChange={(e) => {
                        const selected = Array.from(
                          e.target.selectedOptions,
                          (o) => o.value,
                        );
                        setForm((f) => ({
                          ...f,
                          dynamicFields: {
                            ...f.dynamicFields,
                            weeklyOffs: selected.length > 0 ? selected : ["Sunday"],
                          },
                        }));
                      }}
                    />
                  </FormField>
                </div>
                <p className="text-text-muted mt-1.5 text-xs">
                  Work mode (above) is reused here as the short code (e.g. WFH) inside the
                  timings sentence.
                </p>
              </div>

            </div>
          )}

          {/* §29.4.1.3 — Tiptap Rich Text Editor for custom offer letter body */}
          {form.variant === "TIPTAP_EDITOR" && (
            <div className="space-y-3">
              <FormField label="Employee *" htmlFor="ol-tiptap-employee">
                <EmployeePicker
                  id="ol-tiptap-employee"
                  placeholder="Search employee by name or email..."
                  selected={selectedUser}
                  onSelect={(u) => {
                    setSelectedUser(u);
                    setForm((f) => ({ ...f, userId: u.id }));
                  }}
                  onClear={() => {
                    setSelectedUser(null);
                    setForm((f) => ({ ...f, userId: "" }));
                  }}
                />
              </FormField>
              <FormField label="Offer Letter Body (Rich Text Editor)">
                <TiptapEditor
                content={form.editorContent}
                onChange={(html) => setForm((f) => ({ ...f, editorContent: html }))}
                charLimit={5000}
                placeholder="Dear [Employee Name], We are pleased to offer you..."
                />
              </FormField>
            </div>
          )}

          {/* Signatory Preview + Settings Link */}
          <div className="border-border-default rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Pen size={14} className="text-text-muted" />
                <span className="text-text-primary text-sm font-medium">Signatory</span>
              </div>
              <Link
                href="/admin/settings"
                className="text-primary-500 hover:text-primary-600 flex items-center gap-1 text-xs"
              >
                <Settings size={12} />
                Change in Settings
              </Link>
            </div>
            <div className="mt-3 flex items-center gap-4">
              {signatoryImageUrl ? (
                <div className="bg-bg-muted rounded border p-1.5">
                  <Image
                    src={signatoryImageUrl}
                    alt="Signature"
                    width={120}
                    height={48}
                    className="max-h-12 w-auto object-contain"
                    unoptimized
                  />
                </div>
              ) : (
                <div className="bg-bg-muted text-text-muted flex items-center rounded border px-3 py-2 text-xs italic">
                  No signature image
                </div>
              )}
              <div>
                <p className="text-text-primary text-sm font-medium">{signatoryName}</p>
                <p className="text-text-muted text-xs">{signatoryTitle}</p>
              </div>
            </div>
          </div>
        </div>
      </Modal>

      {/* View Modal */}
      <Modal
        open={modal === "view" && !!viewLetter}
        onClose={() => setModal(null)}
        title="Offer Letter Details"
        size="lg"
        footer={
          <>
            {viewLetter?.generatedFileUrl && (
              <Button
                leftIcon={FileText}
                onClick={() => void handleDownloadPdf(viewLetter)}
              >
                Download PDF
              </Button>
            )}
            <Button variant="outline" onClick={() => setModal(null)}>
              Close
            </Button>
          </>
        }
      >
        {viewLetter && (
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-text-muted">Reference</span>
              <span className="text-text-primary font-mono">{viewLetter.referenceNumber}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">Employee</span>
              <span className="text-text-primary">
                {viewLetter.user.firstName} {viewLetter.user.lastName}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">Variant</span>
              <Badge variant="default">{viewLetter.variant}</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">Status</span>
              <Badge variant={viewLetter.isArchived ? "default" : "success"}>
                {viewLetter.isArchived ? "Archived" : "Active"}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">Created</span>
              <span className="text-text-primary">
                {new Date(viewLetter.createdAt).toLocaleString("en-IN")}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">Generated By</span>
              <span className="text-text-primary">
                {viewLetter.generator.firstName} {viewLetter.generator.lastName}
              </span>
            </div>

            {viewLetter.dynamicFields && Object.keys(viewLetter.dynamicFields).length > 0 && (
              <div>
                <h4 className="text-text-primary mt-3 mb-2 font-medium">Dynamic Fields</h4>
                <Card padding="sm">
                  <div className="space-y-1">
                    {Object.entries(viewLetter.dynamicFields).map(([k, v]) => (
                      <div
                        key={k}
                        className="bg-bg-muted flex justify-between rounded-sm px-3 py-1.5"
                      >
                        <span className="text-text-secondary font-medium">{k}</span>
                        <span className="text-text-primary">{String(v)}</span>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            )}

            {viewLetter.editorContent && (
              <div>
                <h4 className="text-text-primary mt-3 mb-2 font-medium">Content Preview</h4>
                <div
                  className="border-border-default rounded-lg border bg-white p-4"
                  dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(viewLetter.editorContent) }}
                />
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Archive Confirm */}
      <ConfirmDialog
        open={!!archiveId}
        onClose={() => setArchiveId(null)}
        onConfirm={handleArchive}
        title="Archive Offer Letter"
        description="Are you sure you want to archive this offer letter? It can still be viewed but won't appear in active listings."
        confirmLabel="Archive"
      />
    </div>
  );
}
