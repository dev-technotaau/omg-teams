"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
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
  SearchInput,
  DataTable,
  IconButton,
  ConfirmDialog,
  Tooltip,
} from "@/components/ui";
import type { Column, ViewType, RowDensity } from "@/components/ui";
import { TiptapEditor } from "@/components/tiptap-editor";
import { cn } from "@/lib/utils";

// ──────────────────────────────────────────────
//  Admin Offer Letters — Spec Section 29.4
// ──────────────────────────────────────────────

interface UserOption {
  id: string;
  firstName: string;
  lastName: string;
  employeeId: string | null;
  email: string;
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

const emptyForm = {
  userId: "",
  variant: "TEMPLATE" as string,
  dynamicFields: {} as Record<string, string>,
  editorContent: "",
};

export default function AdminOfferLettersPage() {
  const [letters, setLetters] = useState<OfferLetter[]>([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [modal, setModal] = useState<"create" | "view" | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [viewLetter, setViewLetter] = useState<OfferLetter | null>(null);
  const [archiveId, setArchiveId] = useState<string | null>(null);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [fieldKey, setFieldKey] = useState("");
  const [fieldValue, setFieldValue] = useState("");
  const [saving, setSaving] = useState(false);
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

  const stats = useMemo(() => {
    const total = pagination.total;
    const active = letters.filter((l) => !l.isArchived).length;
    const archived = letters.filter((l) => l.isArchived).length;
    const template = letters.filter((l) => l.variant === "TEMPLATE").length;
    return { total, active, archived, template };
  }, [letters, pagination.total]);

  const fetchData = useCallback(async (page = 1) => {
    setIsLoading(true);
    try {
      const res = await listOfferLetters({ page, limit: 20 });
      setLetters(res.data);
      setPagination(res.pagination);
    } catch {
      toast.error("Failed to load offer letters");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
    void fetchSignatoryConfig();
  }, [fetchData, fetchSignatoryConfig]);

  const searchUsers = useCallback(async (q: string) => {
    if (q.length < 2) {
      setUsers([]);
      return;
    }
    try {
      const res = await api.get<{ data: UserOption[] }>("/users", {
        params: { search: q, limit: "10" },
      });
      setUsers(res.data.data);
    } catch {
      /* silent */
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => void searchUsers(userSearch), 300);
    return () => clearTimeout(t);
  }, [userSearch, searchUsers]);

  const openCreate = () => {
    setForm(emptyForm);
    setUserSearch("");
    setUsers([]);
    setFieldKey("");
    setFieldValue("");
    setModal("create");
  };
  const openView = (letter: OfferLetter) => {
    setViewLetter(letter);
    setModal("view");
  };

  const handleGeneratePdf = async (id: string) => {
    try {
      toast.loading("Generating PDF...", { id: "gen-pdf" });
      await generateOfferLetterPdf(id);
      toast.success("PDF generated successfully", { id: "gen-pdf" });
      void fetchData();
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

  const addField = () => {
    if (!fieldKey.trim()) return;
    setForm((f) => ({
      ...f,
      dynamicFields: { ...f.dynamicFields, [fieldKey.trim()]: fieldValue },
    }));
    setFieldKey("");
    setFieldValue("");
  };

  const removeField = (key: string) => {
    setForm((f) => {
      const copy = { ...f.dynamicFields };
      delete copy[key];
      return { ...f, dynamicFields: copy };
    });
  };

  const handleCreate = async () => {
    if (!form.userId) {
      toast.error("Please select an employee");
      return;
    }
    setSaving(true);
    try {
      await createOfferLetter({
        userId: form.userId,
        variant: form.variant,
        ...(form.variant === "TEMPLATE"
          ? { dynamicFields: form.dynamicFields }
          : { editorContent: form.editorContent }),
      });
      toast.success("Offer letter created");
      setModal(null);
      void fetchData();
    } catch {
      toast.error("Failed to create offer letter");
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async () => {
    if (!archiveId) return;
    try {
      await archiveOfferLetter(archiveId);
      toast.success("Offer letter archived");
      setArchiveId(null);
      void fetchData(pagination.page);
    } catch {
      toast.error("Failed to archive");
    }
  };

  const selectedUser = users.find((u) => u.id === form.userId);

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
                onClick={() => void handleGeneratePdf(l.id)}
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
                onClick={() => window.open(l.generatedFileUrl!, "_blank")}
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
                      window.open(l.generatedFileUrl!, "_blank");
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
        description={`${pagination.total} total offer letters`}
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
        onPageChange={(p) => void fetchData(p)}
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
          {/* Employee Search */}
          <FormField label="Employee" required>
            {selectedUser ? (
              <div className="border-border-default bg-bg-input flex items-center justify-between rounded-md border px-3 py-2">
                <span className="text-text-primary text-sm">
                  {selectedUser.firstName} {selectedUser.lastName} ({selectedUser.email})
                </span>
                <button
                  onClick={() => setForm((f) => ({ ...f, userId: "" }))}
                  className="text-error-500 text-xs"
                >
                  Change
                </button>
              </div>
            ) : (
              <div className="relative">
                <SearchInput
                  value={userSearch}
                  onChange={setUserSearch}
                  placeholder="Search employee by name or email..."
                />
                {users.length > 0 && (
                  <div className="border-border-default bg-bg-surface-raised absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-md border shadow-lg">
                    {users.map((u) => (
                      <button
                        key={u.id}
                        onClick={() => {
                          setForm((f) => ({
                            ...f,
                            userId: u.id,
                            // §29.4.2 — Auto-fill employee name in dynamic fields
                            dynamicFields: {
                              ...f.dynamicFields,
                              employeeName: `${u.firstName} ${u.lastName}`,
                            },
                          }));
                          setUsers([]);
                          setUserSearch("");
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
            )}
          </FormField>

          {/* Variant Selection */}
          <FormField label="Variant">
            <div className="grid grid-cols-2 gap-3">
              {VARIANT_OPTIONS.map((v) => (
                <button
                  key={v.value}
                  onClick={() => setForm((f) => ({ ...f, variant: v.value }))}
                  className={cn(
                    "rounded-lg border p-3 text-left transition",
                    form.variant === v.value
                      ? "border-primary-500 bg-primary-100"
                      : "border-border-default hover:border-border-hover",
                  )}
                >
                  <div className="text-text-primary text-sm font-medium">{v.label}</div>
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
                <FormField label="Employee Name *" htmlFor="ol-name">
                  <Input
                    id="ol-name"
                    value={String(form.dynamicFields["employeeName"] ?? "")}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        dynamicFields: { ...f.dynamicFields, employeeName: e.target.value },
                      }))
                    }
                    placeholder="e.g. Simarjot Kaur"
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
                    placeholder="e.g. Hiring Associate (Work From Home)"
                  />
                </FormField>

                <FormField label="Date of Joining" htmlFor="ol-joining">
                  <Input
                    id="ol-joining"
                    value={String(form.dynamicFields["joiningDate"] ?? "")}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        dynamicFields: { ...f.dynamicFields, joiningDate: e.target.value },
                      }))
                    }
                    placeholder="e.g. 23rd December 2025"
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

              {/* Additional custom fields (key-value) for anything beyond the standard 6 */}
              <details className="text-sm">
                <summary className="text-text-muted cursor-pointer text-xs">
                  + Add additional custom fields
                </summary>
                <div className="mt-2 flex gap-2">
                  <Input
                    value={fieldKey}
                    onChange={(e) => setFieldKey(e.target.value)}
                    placeholder="Key (e.g. department)"
                    className="flex-1"
                  />
                  <Input
                    value={fieldValue}
                    onChange={(e) => setFieldValue(e.target.value)}
                    placeholder="Value"
                    className="flex-1"
                  />
                  <Button variant="secondary" onClick={addField} disabled={!fieldKey.trim()}>
                    Add
                  </Button>
                </div>
                {Object.entries(form.dynamicFields)
                  .filter(
                    ([k]) =>
                      ![
                        "employeeName",
                        "positionTitle",
                        "joiningDate",
                        "salaryAmount",
                        "probationPeriod",
                        "noticePeriod",
                      ].includes(k),
                  )
                  .map(([k, v]) => (
                    <div
                      key={k}
                      className="bg-bg-muted mt-1 flex items-center gap-2 rounded-sm px-3 py-1.5 text-xs"
                    >
                      <span className="text-text-primary font-medium">{k}:</span>
                      <span className="text-text-secondary flex-1">{v}</span>
                      <button onClick={() => removeField(k)} className="text-error-500">
                        Remove
                      </button>
                    </div>
                  ))}
              </details>
            </div>
          )}

          {/* §29.4.1.3 — Tiptap Rich Text Editor for custom offer letter body */}
          {form.variant === "TIPTAP_EDITOR" && (
            <FormField label="Offer Letter Body (Rich Text Editor)">
              <TiptapEditor
                content={form.editorContent}
                onChange={(html) => setForm((f) => ({ ...f, editorContent: html }))}
                charLimit={5000}
                placeholder="Dear {{employeeName}}, We are pleased to offer you..."
                dynamicFields={[
                  "employeeName",
                  "employeeId",
                  "employeeEmail",
                  "positionTitle",
                  "dateOfIssue",
                  "joiningDate",
                  "salaryAmount",
                  "probationPeriod",
                  "noticePeriod",
                  "referenceNumber",
                  "reportingManager",
                ]}
              />
            </FormField>
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
              <a href={viewLetter.generatedFileUrl} target="_blank" rel="noopener noreferrer">
                <Button leftIcon={FileText}>Download PDF</Button>
              </a>
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
