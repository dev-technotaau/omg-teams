"use client";

import { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { qk } from "@/lib/query-keys";
import DOMPurify from "isomorphic-dompurify";
import { Mail, Copy, Eye, RotateCcw, Save } from "lucide-react";
import { toast } from "sonner";
import { extractApiError } from "@/lib/api";
import { useCopyToClipboard } from "@/hooks";
import {
  listTemplates,
  getTemplate,
  updateTemplate,
  resetTemplate,
  previewTemplate,
  EmailTemplate,
} from "@/services/email-template.service";
import {
  PageHeader,
  Card,
  Badge,
  Button,
  Modal,
  FormField,
  Input,
  Textarea,
  TableSkeleton,
  EmptyState,
  ConfirmDialog,
} from "@/components/ui";

// ──────────────────────────────────────────────
//  Email Templates — Spec Section 23.13
// ──────────────────────────────────────────────

interface TemplateDetail extends EmailTemplate {
  variables: string[];
}

export default function EmailTemplatesPage() {
  const qc = useQueryClient();
  const templatesQuery = useQuery({
    queryKey: qk.emailTemplates.list(),
    queryFn: listTemplates,
  });
  const templates = templatesQuery.data ?? [];
  const isLoading = templatesQuery.isLoading;
  const fetchTemplates = useCallback(
    () => qc.invalidateQueries({ queryKey: qk.emailTemplates.all() }),
    [qc],
  );

  const [selected, setSelected] = useState<TemplateDetail | null>(null);
  const [editSubject, setEditSubject] = useState("");
  const [editBody, setEditBody] = useState("");
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const openEditor = async (key: string) => {
    try {
      const detail = await getTemplate(key);
      setSelected(detail as TemplateDetail);
      setEditSubject(detail.subject);
      setEditBody(detail.bodyHtml);
      setPreviewHtml(null);
    } catch (err) {
      toast.error(extractApiError(err).message);
    }
  };

  const handleSave = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await updateTemplate(selected.templateKey, { subject: editSubject, bodyHtml: editBody });
      toast.success("Template saved");
      setSelected(null);
      void fetchTemplates();
    } catch (err) {
      toast.error(extractApiError(err).message);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!selected) return;
    try {
      await resetTemplate(selected.templateKey);
      toast.success("Template reset to default");
      setSelected(null);
      void fetchTemplates();
    } catch (err) {
      toast.error(extractApiError(err).message);
    }
  };

  const handlePreview = async () => {
    if (!selected) return;
    try {
      const sampleVars: Record<string, string> = {};
      for (const v of selected.variables) sampleVars[v] = `[${v}]`;
      const result = await previewTemplate(selected.templateKey, sampleVars);
      setPreviewHtml(result.bodyHtml);
    } catch (err) {
      toast.error(extractApiError(err).message);
    }
  };

  const { copy: copyText } = useCopyToClipboard();

  const copyVariable = (v: string) => {
    void copyText(`{{${v}}}`);
    toast.success(`Copied {{${v}}}`);
  };

  const formatKey = (key: string) =>
    key.replace(/[_-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div className="space-y-4">
      <PageHeader title="Email Templates" />

      {isLoading ? (
        <TableSkeleton rows={6} />
      ) : templates.length === 0 ? (
        <EmptyState
          icon={Mail}
          title="No email templates"
          description="Templates will appear here once configured."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((t) => (
            <Card
              key={t.templateKey}
              hover
              onClick={() => void openEditor(t.templateKey)}
              className="text-left"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-text-primary font-medium">{formatKey(t.templateKey)}</p>
                {t.isCustomized && (
                  <Badge variant="success" size="sm">
                    Customized
                  </Badge>
                )}
              </div>
              <p className="text-text-secondary mt-1 truncate text-sm">{t.subject}</p>
              <p className="text-text-muted mt-2 text-xs">
                Updated {t.updatedAt ? new Date(t.updatedAt).toLocaleDateString() : "N/A"}
              </p>
            </Card>
          ))}
        </div>
      )}

      {/* Editor Modal */}
      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected ? formatKey(selected.templateKey) : ""}
        description={selected ? `Key: ${selected.templateKey}` : undefined}
        size="full"
        footer={
          <>
            <Button
              variant="outline"
              leftIcon={RotateCcw}
              onClick={() => setShowResetConfirm(true)}
              disabled={!selected?.isCustomized}
            >
              Reset to Default
            </Button>
            <Button variant="outline" leftIcon={Eye} onClick={() => void handlePreview()}>
              Preview
            </Button>
            <Button leftIcon={Save} loading={saving} onClick={() => void handleSave()}>
              Save
            </Button>
          </>
        }
      >
        {selected && (
          <div className="flex h-full gap-4">
            <div className="flex flex-1 flex-col gap-3">
              <FormField label="Subject">
                <Input
                  value={editSubject}
                  onChange={(e) => setEditSubject(e.target.value)}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void handleSave();
                  }}
                />
              </FormField>
              <FormField label="Body HTML" className="flex flex-1 flex-col">
                <Textarea
                  value={editBody}
                  onChange={(e) => setEditBody(e.target.value)}
                  resize="none"
                  rows={12}
                  className="flex-1 font-mono"
                />
              </FormField>
              {previewHtml !== null && (
                <div className="border-border-default rounded-md border bg-white p-4 text-sm">
                  <p className="text-text-muted mb-2 text-xs font-medium">Preview</p>
                  <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(previewHtml) }} />
                </div>
              )}
            </div>

            {/* Variables Panel */}
            <div className="w-52 shrink-0 space-y-2">
              <p className="text-text-secondary text-sm font-medium">Available Variables</p>
              {selected.variables.map((v) => (
                <button
                  key={v}
                  onClick={() => copyVariable(v)}
                  className="border-border-default bg-bg-muted hover:bg-bg-hover flex w-full items-center gap-2 rounded-md border px-2 py-1.5 text-left font-mono text-xs"
                >
                  <Copy size={12} className="text-text-muted shrink-0" />
                  <span className="truncate">{`{{${v}}}`}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={showResetConfirm}
        onClose={() => setShowResetConfirm(false)}
        onConfirm={handleReset}
        title="Reset Template"
        description="This will revert the template to its default content. Your customizations will be lost."
        confirmLabel="Reset"
        variant="danger"
      />
    </div>
  );
}
