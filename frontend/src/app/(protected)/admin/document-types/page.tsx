"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2, ArrowUp, ArrowDown, FileCheck } from "lucide-react";
import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { qk } from "@/lib/query-keys";
import { toastApiError } from "@/lib/query-helpers";
import {
  PageHeader,
  Card,
  Badge,
  Button,
  Modal,
  FormField,
  Input,
  Textarea,
  IconButton,
  Tooltip,
  TableSkeleton,
  EmptyState,
  ConfirmDialog,
  Checkbox,
} from "@/components/ui";
import { cn } from "@/lib/utils";

// ──────────────────────────────────────────────
//  Admin Document Type Management — Spec §29.1
//  CRUD for document types employees must upload
// ──────────────────────────────────────────────

interface DocumentType {
  id: string;
  name: string;
  code: string;
  description: string | null;
  acceptedFormats: string[];
  isRequired: boolean;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
}

const FORMAT_OPTIONS = [
  { value: "application/pdf", label: "PDF" },
  { value: "image/jpeg", label: "JPEG" },
  { value: "image/png", label: "PNG" },
  {
    value: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    label: "DOCX",
  },
];

const FORMAT_LABELS: Record<string, string> = {
  "application/pdf": "PDF",
  "image/jpeg": "JPEG",
  "image/png": "PNG",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "DOCX",
  pdf: "PDF",
  jpg: "JPEG",
  png: "PNG",
  doc: "DOC",
  docx: "DOCX",
};

export default function DocumentTypesPage() {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<DocumentType | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DocumentType | null>(null);

  // Form state
  const [formName, setFormName] = useState("");
  const [formCode, setFormCode] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formFormats, setFormFormats] = useState<string[]>([
    "application/pdf",
    "image/jpeg",
    "image/png",
  ]);
  const [formRequired, setFormRequired] = useState(false);

  // Server state via TanStack Query — cache + background refetch on focus.
  const { data: types = [], isLoading } = useQuery({
    queryKey: qk.documentTypes.list(),
    queryFn: async () => {
      const res = await api.get<{ types: DocumentType[] }>("/documents/types/all");
      return res.data.types;
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: qk.documentTypes.lists() });

  // Combined create/update — the modal handles both, server distinguishes by id.
  const upsertMutation = useMutation({
    mutationFn: async (payload: {
      id?: string;
      name: string;
      code: string;
      description?: string;
      acceptedFormats: string[];
      isRequired: boolean;
    }) => {
      const { id, ...body } = payload;
      if (id) {
        await api.patch(`/documents/types/manage/${id}`, body);
      } else {
        await api.post("/documents/types/manage", body);
      }
    },
    onSuccess: (_data, vars) => {
      toast.success(vars.id ? "Document type updated" : "Document type created");
      setShowModal(false);
      void invalidate();
    },
    onError: (err) => toastApiError(err, "Failed to save document type"),
  });

  // Optimistic delete (deactivate) — yank from cache instantly, rollback on error.
  const deactivateMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/documents/types/manage/${id}`),
    onMutate: async (id) => {
      const key = qk.documentTypes.list();
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<DocumentType[]>(key);
      qc.setQueryData<DocumentType[]>(key, (old) => (old ?? []).filter((t) => t.id !== id));
      return { prev, key };
    },
    onError: (err, _id, ctx) => {
      if (ctx) qc.setQueryData(ctx.key, ctx.prev);
      toastApiError(err, "Failed to deactivate document type");
    },
    onSuccess: () => {
      toast.success("Document type deactivated");
      setDeleteTarget(null);
    },
    onSettled: () => void invalidate(),
  });

  // Optimistic toggle — flip isActive in cache instantly.
  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.patch(`/documents/types/manage/${id}`, { isActive }),
    onMutate: async ({ id, isActive }) => {
      const key = qk.documentTypes.list();
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<DocumentType[]>(key);
      qc.setQueryData<DocumentType[]>(key, (old) =>
        (old ?? []).map((t) => (t.id === id ? { ...t, isActive } : t)),
      );
      return { prev, key };
    },
    onError: (err, _vars, ctx) => {
      if (ctx) qc.setQueryData(ctx.key, ctx.prev);
      toastApiError(err, "Failed to toggle status");
    },
    onSuccess: (_d, vars) => toast.success(vars.isActive ? "Activated" : "Deactivated"),
    onSettled: () => void invalidate(),
  });

  // Reorder swaps two adjacent records' sortOrder values; we just invalidate
  // afterwards (the affected rows are tiny and the optimistic patch isn't worth it).
  const reorderMutation = useMutation({
    mutationFn: async (vars: {
      a: { id: string; sortOrder: number };
      b: { id: string; sortOrder: number };
    }) => {
      await Promise.all([
        api.patch(`/documents/types/manage/${vars.a.id}`, { sortOrder: vars.b.sortOrder }),
        api.patch(`/documents/types/manage/${vars.b.id}`, { sortOrder: vars.a.sortOrder }),
      ]);
    },
    onError: (err) => toastApiError(err, "Failed to reorder"),
    onSettled: () => void invalidate(),
  });

  const openCreate = () => {
    setEditTarget(null);
    setFormName("");
    setFormCode("");
    setFormDescription("");
    setFormFormats(["application/pdf", "image/jpeg", "image/png"]);
    setFormRequired(false);
    setShowModal(true);
  };

  const openEdit = (dt: DocumentType) => {
    setEditTarget(dt);
    setFormName(dt.name);
    setFormCode(dt.code);
    setFormDescription(dt.description ?? "");
    setFormFormats(dt.acceptedFormats);
    setFormRequired(dt.isRequired);
    setShowModal(true);
  };

  const handleSubmit = () => {
    if (!formName.trim() || !formCode.trim()) {
      toast.error("Name and code are required");
      return;
    }
    upsertMutation.mutate({
      ...(editTarget ? { id: editTarget.id } : {}),
      name: formName,
      code: formCode.toUpperCase(),
      ...(formDescription ? { description: formDescription } : {}),
      acceptedFormats: formFormats,
      isRequired: formRequired,
    });
  };

  const handleDeactivate = () => {
    if (!deleteTarget) return;
    deactivateMutation.mutate(deleteTarget.id);
  };

  const handleToggleActive = (dt: DocumentType) => {
    toggleActiveMutation.mutate({ id: dt.id, isActive: !dt.isActive });
  };

  const handleReorder = (dt: DocumentType, direction: "up" | "down") => {
    const idx = types.findIndex((t) => t.id === dt.id);
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= types.length) return;
    const other = types[swapIdx];
    if (!other) return;
    reorderMutation.mutate({
      a: { id: dt.id, sortOrder: dt.sortOrder },
      b: { id: other.id, sortOrder: other.sortOrder },
    });
  };

  const toggleFormat = (format: string) => {
    setFormFormats((prev) =>
      prev.includes(format) ? prev.filter((f) => f !== format) : [...prev, format],
    );
  };

  if (isLoading) return <TableSkeleton rows={5} />;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Document Types"
        description="Manage document types employees must upload for KYC verification"
        actions={
          <Button leftIcon={Plus} onClick={openCreate}>
            Add Document Type
          </Button>
        }
      />

      {types.length === 0 ? (
        <EmptyState
          icon={FileCheck}
          title="No document types"
          description="Create document types that employees must upload."
        />
      ) : (
        <div className="space-y-2">
          {types.map((dt, idx) => (
            <Card key={dt.id} className={cn(!dt.isActive && "opacity-60")}>
              <div className="flex items-center gap-4 px-4 py-3">
                {/* Reorder arrows */}
                <div className="flex flex-col gap-0.5">
                  <Tooltip content="Move up">
                    <IconButton
                      icon={ArrowUp}
                      aria-label="Move up"
                      size="xs"
                      variant="ghost"
                      disabled={idx === 0}
                      onClick={() => void handleReorder(dt, "up")}
                    />
                  </Tooltip>
                  <Tooltip content="Move down">
                    <IconButton
                      icon={ArrowDown}
                      aria-label="Move down"
                      size="xs"
                      variant="ghost"
                      disabled={idx === types.length - 1}
                      onClick={() => void handleReorder(dt, "down")}
                    />
                  </Tooltip>
                </div>

                {/* Info */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-text-primary font-medium">{dt.name}</h3>
                    <Badge variant="outline" size="sm">
                      {dt.code}
                    </Badge>
                    {dt.isRequired && (
                      <Badge variant="danger" size="sm">
                        Required
                      </Badge>
                    )}
                    {!dt.isActive && (
                      <Badge variant="warning" size="sm">
                        Inactive
                      </Badge>
                    )}
                  </div>
                  {dt.description && (
                    <p className="text-text-muted mt-0.5 text-xs">{dt.description}</p>
                  )}
                  <div className="mt-1 flex gap-1">
                    {dt.acceptedFormats.map((f) => (
                      <span
                        key={f}
                        className="bg-bg-muted text-text-secondary rounded px-1.5 py-0.5 text-[10px] font-medium uppercase"
                      >
                        {FORMAT_LABELS[f] ?? f}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="xs" onClick={() => void handleToggleActive(dt)}>
                    {dt.isActive ? "Deactivate" : "Activate"}
                  </Button>
                  <Tooltip content="Edit">
                    <IconButton
                      icon={Pencil}
                      aria-label="Edit"
                      size="xs"
                      onClick={() => openEdit(dt)}
                    />
                  </Tooltip>
                  <Tooltip content="Deactivate">
                    <IconButton
                      icon={Trash2}
                      aria-label="Deactivate"
                      size="xs"
                      variant="danger"
                      onClick={() => setDeleteTarget(dt)}
                    />
                  </Tooltip>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editTarget ? "Edit Document Type" : "Add Document Type"}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Name" required htmlFor="dt-name">
              <Input
                id="dt-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. Aadhaar Card"
                autoFocus
              />
            </FormField>
            <FormField label="Code" required htmlFor="dt-code">
              <Input
                id="dt-code"
                value={formCode}
                onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                placeholder="e.g. AADHAAR"
                className="font-mono uppercase"
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleSubmit();
                }}
              />
            </FormField>
          </div>

          <FormField label="Description" htmlFor="dt-desc">
            <Textarea
              id="dt-desc"
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              placeholder="Brief description of what this document is"
              rows={2}
            />
          </FormField>

          <FormField label="Accepted Formats">
            <div className="flex flex-wrap gap-2">
              {FORMAT_OPTIONS.map((opt) => (
                <Checkbox
                  key={opt.value}
                  checked={formFormats.includes(opt.value)}
                  onChange={() => toggleFormat(opt.value)}
                  label={opt.label}
                />
              ))}
            </div>
          </FormField>

          <Checkbox
            checked={formRequired}
            onChange={(checked) => setFormRequired(checked)}
            label="Required for KYC (Employee cannot complete KYC without uploading this)"
          />

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button onClick={() => void handleSubmit()}>
              {editTarget ? "Save Changes" : "Create"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Deactivate Confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeactivate}
        title="Deactivate Document Type"
        description={`Deactivate "${deleteTarget?.name}"? It will be hidden from employees but existing uploads are preserved.`}
        confirmLabel="Deactivate"
        variant="danger"
      />
    </div>
  );
}
