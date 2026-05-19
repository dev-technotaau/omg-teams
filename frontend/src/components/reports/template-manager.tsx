"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bookmark, Pencil, Save, Trash2, FolderOpen } from "lucide-react";
import { toast } from "sonner";
import {
  Button,
  ConfirmDialog,
  EmptyState,
  FormField,
  IconButton,
  Input,
  Modal,
  Switch,
  Textarea,
  Tooltip,
} from "@/components/ui";
import { qk } from "@/lib/query-keys";
import { extractApiError } from "@/lib/api";
import {
  createTemplate,
  deleteTemplate,
  listTemplates,
  updateTemplate,
  type ReportTemplate,
  type SaveTemplateInput,
} from "@/services/report.service";

// ─────────────────────────────────────────────────────────────
//  TemplateManager — list + load + edit + delete + save
//
//  Used in both the Generate and Schedule tabs. The parent
//  passes the *current* report type + column selection + filters
//  so "Save current as template" works in-place.
// ─────────────────────────────────────────────────────────────

interface TemplateManagerProps {
  open: boolean;
  onClose: () => void;
  reportType: string;
  currentColumnKeys: string[];
  currentFilters: Record<string, unknown>;
  /** Called when the admin loads a template — parent should apply it. */
  onLoad: (template: ReportTemplate) => void;
  /** Currently-loaded template id (for highlighting + "update" mode). */
  activeTemplateId?: string | null;
  /** Current user id — for ownership-based edit/delete affordances. */
  currentUserId: string;
}

export function TemplateManager({
  open,
  onClose,
  reportType,
  currentColumnKeys,
  currentFilters,
  onLoad,
  activeTemplateId,
  currentUserId,
}: TemplateManagerProps) {
  const qc = useQueryClient();
  const [saveOpen, setSaveOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ReportTemplate | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ReportTemplate | null>(null);

  // Form state for the save/update dialog
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isShared, setIsShared] = useState(false);
  const [updateMode, setUpdateMode] = useState<"new" | "overwrite">("new");

  const templatesQuery = useQuery({
    queryKey: qk.reportsManagement.templates(reportType || undefined),
    queryFn: () => listTemplates(reportType || undefined),
    enabled: open,
  });

  const templates = templatesQuery.data ?? [];

  const createMut = useMutation({
    mutationFn: (input: SaveTemplateInput) => createTemplate(input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.reportsManagement.all() });
      toast.success("Template saved");
      setSaveOpen(false);
      resetForm();
    },
    onError: (err) => toast.error(extractApiError(err).message),
  });

  const updateMut = useMutation({
    mutationFn: (vars: { id: string; input: Partial<SaveTemplateInput> }) =>
      updateTemplate(vars.id, vars.input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.reportsManagement.all() });
      toast.success("Template updated");
      setSaveOpen(false);
      setEditTarget(null);
      resetForm();
    },
    onError: (err) => toast.error(extractApiError(err).message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteTemplate(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.reportsManagement.all() });
      toast.success("Template deleted");
      setDeleteTarget(null);
    },
    onError: (err) => toast.error(extractApiError(err).message),
  });

  const resetForm = () => {
    setName("");
    setDescription("");
    setIsShared(false);
    setUpdateMode("new");
  };

  const openSaveNew = () => {
    resetForm();
    setEditTarget(null);
    setSaveOpen(true);
  };

  const openEditTemplate = (t: ReportTemplate) => {
    setEditTarget(t);
    setName(t.name);
    setDescription(t.description ?? "");
    setIsShared(t.isShared);
    setUpdateMode("overwrite");
    setSaveOpen(true);
  };

  const handleSubmit = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Template name is required");
      return;
    }
    if (!reportType) {
      toast.error("Select a report type before saving a template");
      return;
    }
    if (currentColumnKeys.length === 0) {
      toast.error("Select at least one column before saving a template");
      return;
    }
    const payload: SaveTemplateInput = {
      name: trimmed,
      reportType,
      columnKeys: currentColumnKeys,
      filters: currentFilters,
      description: description.trim() || null,
      isShared,
    };
    if (editTarget && updateMode === "overwrite") {
      updateMut.mutate({ id: editTarget.id, input: payload });
    } else {
      createMut.mutate(payload);
    }
  };

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title="Report Templates"
        description={
          reportType
            ? "Save the current column selection + filters as a reusable template, or load an existing one."
            : "Pick a report type first to see compatible templates."
        }
        size="xl"
      >
        <div className="space-y-3">
          <div className="flex justify-end">
            <Button leftIcon={Save} onClick={openSaveNew} disabled={!reportType}>
              Save current as new template
            </Button>
          </div>

          {templatesQuery.isLoading ? (
            <p className="text-text-secondary py-6 text-center text-sm">Loading templates…</p>
          ) : templates.length === 0 ? (
            <EmptyState
              icon={Bookmark}
              title="No templates yet"
              description="Save the column selection + filters you use most as a template to load instantly later."
            />
          ) : (
            <ul className="divide-border-default border-border-default divide-y rounded border">
              {templates.map((t) => {
                const isActive = activeTemplateId === t.id;
                const isOwner = t.createdById === currentUserId;
                return (
                  <li
                    key={t.id}
                    className={`hover:bg-bg-muted flex items-start gap-3 px-3 py-2.5 ${
                      isActive ? "bg-bg-muted" : ""
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-text-primary truncate text-sm font-medium">
                          {t.name}
                        </p>
                        {isActive && (
                          <span className="bg-primary-100 text-primary-700 rounded px-1.5 text-[10px] font-medium uppercase">
                            Loaded
                          </span>
                        )}
                        {t.isShared && (
                          <span className="bg-bg-muted text-text-secondary rounded px-1.5 text-[10px] font-medium uppercase">
                            Shared
                          </span>
                        )}
                      </div>
                      <p className="text-text-secondary text-xs">
                        {t.columnConfig.length} column{t.columnConfig.length === 1 ? "" : "s"} ·{" "}
                        {t.usageCount} schedule{t.usageCount === 1 ? "" : "s"}
                        {t.createdByName ? ` · by ${t.createdByName}` : ""}
                      </p>
                      {t.description && (
                        <p className="text-text-secondary mt-0.5 line-clamp-2 text-xs">
                          {t.description}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-shrink-0 gap-1">
                      <Tooltip content="Load this template">
                        <IconButton
                          icon={FolderOpen}
                          aria-label="Load"
                          size="xs"
                          onClick={() => {
                            onLoad(t);
                            onClose();
                          }}
                        />
                      </Tooltip>
                      {isOwner && (
                        <>
                          <Tooltip content="Rename / overwrite">
                            <IconButton
                              icon={Pencil}
                              aria-label="Edit"
                              size="xs"
                              onClick={() => openEditTemplate(t)}
                            />
                          </Tooltip>
                          <Tooltip content="Delete">
                            <IconButton
                              icon={Trash2}
                              aria-label="Delete"
                              variant="danger"
                              size="xs"
                              onClick={() => setDeleteTarget(t)}
                            />
                          </Tooltip>
                        </>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </Modal>

      {/* Save / Edit dialog */}
      <Modal
        open={saveOpen}
        onClose={() => {
          setSaveOpen(false);
          setEditTarget(null);
          resetForm();
        }}
        title={editTarget ? "Update Template" : "Save as Template"}
        size="md"
      >
        <div className="space-y-3">
          <FormField label="Name" required>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Monthly Mumbai Recap"
              maxLength={120}
            />
          </FormField>
          <FormField label="Description">
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional — what this template is for"
              rows={2}
              maxLength={500}
            />
          </FormField>
          <FormField label="Share with all admins">
            <Switch
              checked={isShared}
              onChange={(checked) => setIsShared(checked)}
              label={isShared ? "Visible to every admin" : "Only visible to you"}
            />
          </FormField>
          {editTarget && (
            <FormField label="When saving">
              <div className="flex flex-col gap-1.5 text-sm">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="update-mode"
                    checked={updateMode === "overwrite"}
                    onChange={() => setUpdateMode("overwrite")}
                  />
                  <span>Overwrite &quot;{editTarget.name}&quot;</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="update-mode"
                    checked={updateMode === "new"}
                    onChange={() => setUpdateMode("new")}
                  />
                  <span>Save as a new template</span>
                </label>
              </div>
            </FormField>
          )}
          <p className="text-text-secondary text-xs">
            This template will store {currentColumnKeys.length} column
            {currentColumnKeys.length === 1 ? "" : "s"} and the current filter selection.
          </p>
          <div className="flex justify-end gap-2 pt-1">
            <Button
              variant="outline"
              onClick={() => {
                setSaveOpen(false);
                setEditTarget(null);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              loading={createMut.isPending || updateMut.isPending}
            >
              {editTarget && updateMode === "overwrite" ? "Update" : "Save"}
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) deleteMut.mutate(deleteTarget.id);
        }}
        title="Delete Template"
        description={
          deleteTarget
            ? `Delete the "${deleteTarget.name}" template? Schedules referencing it will keep their saved columns but lose the link.`
            : ""
        }
        confirmLabel="Delete"
        variant="danger"
      />
    </>
  );
}
