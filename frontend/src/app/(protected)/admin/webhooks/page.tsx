"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { qk } from "@/lib/query-keys";
import { toastApiError } from "@/lib/query-helpers";
import {
  Webhook,
  Plus,
  Pencil,
  Trash2,
  Play,
  RotateCw,
  Copy,
  CheckCircle2,
  XCircle,
  Eye,
  EyeOff,
} from "lucide-react";
import { toast } from "sonner";
import {
  listWebhooks,
  listWebhookEvents,
  createWebhook,
  updateWebhook,
  deleteWebhook,
  testWebhook,
  rotateWebhookSecret,
  type WebhookEndpoint,
} from "@/services/webhook.service";
import {
  PageHeader,
  Card,
  Button,
  Input,
  FormField,
  Badge,
  Modal,
  ConfirmDialog,
  EmptyState,
  Checkbox,
  TableSkeleton,
} from "@/components/ui";

// ──────────────────────────────────────────────
//  Webhook Management Page — Admin-only
// ──────────────────────────────────────────────

export default function WebhooksPage() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [newSecret, setNewSecret] = useState<string | null>(null);
  const [showSecret, setShowSecret] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);

  // Form state
  const [formUrl, setFormUrl] = useState("");
  const [formEvents, setFormEvents] = useState<string[]>([]);
  const [formDescription, setFormDescription] = useState("");

  // Two parallel queries — webhooks list (mutates often) and the available
  // event types (effectively static, longer staleTime).
  const webhooksQuery = useQuery({
    queryKey: qk.webhooks.list(),
    queryFn: listWebhooks,
  });
  const eventsQuery = useQuery({
    queryKey: [...qk.webhooks.all(), "events"] as const,
    queryFn: listWebhookEvents,
    staleTime: 60 * 60 * 1000, // 1h — event types rarely change
  });
  const webhooks = webhooksQuery.data ?? [];
  const availableEvents = eventsQuery.data ?? [];
  const loading = webhooksQuery.isLoading || eventsQuery.isLoading;

  const invalidate = () => qc.invalidateQueries({ queryKey: qk.webhooks.lists() });

  const createMutation = useMutation({
    mutationFn: createWebhook,
    onSuccess: (result) => {
      setNewSecret(result.secret);
      setShowCreate(false);
      resetForm();
      void invalidate();
      toast.success("Webhook created. Copy the signing secret — it won't be shown again.");
    },
    onError: (err) => toastApiError(err, "Failed to create webhook"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Parameters<typeof updateWebhook>[1] }) =>
      updateWebhook(id, payload),
    onSuccess: () => {
      setEditId(null);
      resetForm();
      void invalidate();
      toast.success("Webhook updated");
    },
    onError: (err) => toastApiError(err, "Failed to update webhook"),
  });

  // Optimistic toggle — flip isActive in the cache instantly.
  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      updateWebhook(id, { isActive }),
    onMutate: async ({ id, isActive }) => {
      const key = qk.webhooks.list();
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<WebhookEndpoint[]>(key);
      qc.setQueryData<WebhookEndpoint[]>(key, (old) =>
        (old ?? []).map((w) => (w.id === id ? { ...w, isActive } : w)),
      );
      return { prev, key };
    },
    onError: (err, _vars, ctx) => {
      if (ctx) qc.setQueryData(ctx.key, ctx.prev);
      toastApiError(err, "Failed to toggle webhook");
    },
    onSuccess: (_d, vars) =>
      toast.success(vars.isActive ? "Webhook enabled" : "Webhook disabled"),
    onSettled: () => void invalidate(),
  });

  // Optimistic delete.
  const deleteMutation = useMutation({
    mutationFn: deleteWebhook,
    onMutate: async (id: string) => {
      const key = qk.webhooks.list();
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<WebhookEndpoint[]>(key);
      qc.setQueryData<WebhookEndpoint[]>(key, (old) => (old ?? []).filter((w) => w.id !== id));
      return { prev, key };
    },
    onError: (err, _id, ctx) => {
      if (ctx) qc.setQueryData(ctx.key, ctx.prev);
      toastApiError(err, "Failed to delete webhook");
    },
    onSuccess: () => {
      setDeleteId(null);
      toast.success("Webhook deleted");
    },
    onSettled: () => void invalidate(),
  });

  const saving = createMutation.isPending || updateMutation.isPending;

  const resetForm = () => {
    setFormUrl("");
    setFormEvents([]);
    setFormDescription("");
  };

  const handleCreate = () => {
    if (!formUrl || formEvents.length === 0) return;
    createMutation.mutate({
      url: formUrl,
      events: formEvents,
      ...(formDescription ? { description: formDescription } : {}),
    });
  };

  const handleUpdate = () => {
    if (!editId || !formUrl || formEvents.length === 0) return;
    updateMutation.mutate({
      id: editId,
      payload: {
        url: formUrl,
        events: formEvents,
        ...(formDescription ? { description: formDescription } : {}),
      },
    });
  };

  const handleDelete = () => {
    if (!deleteId) return;
    deleteMutation.mutate(deleteId);
  };

  const handleToggleActive = (wh: WebhookEndpoint) => {
    toggleActiveMutation.mutate({ id: wh.id, isActive: !wh.isActive });
  };

  const handleTest = async (id: string) => {
    setTestingId(id);
    try {
      const result = await testWebhook(id);
      if (result.success) {
        toast.success(`Test successful (${result.statusCode})`);
      } else {
        toast.error(`Test failed: ${result.error ?? result.statusText}`);
      }
    } catch {
      toast.error("Test request failed");
    } finally {
      setTestingId(null);
    }
  };

  const handleRotateSecret = async (id: string) => {
    try {
      const secret = await rotateWebhookSecret(id);
      setNewSecret(secret);
      toast.success("Secret rotated. Copy the new secret — it won't be shown again.");
    } catch {
      toast.error("Failed to rotate secret");
    }
  };

  const copyToClipboard = (text: string) => {
    void navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  const toggleEvent = (event: string) => {
    setFormEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event],
    );
  };

  const openEdit = (wh: WebhookEndpoint) => {
    setEditId(wh.id);
    setFormUrl(wh.url);
    setFormEvents(wh.events);
    setFormDescription(wh.description ?? "");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader title="Webhooks" description="Manage external webhook integrations" />
        <Button
          leftIcon={Plus}
          onClick={() => {
            resetForm();
            setShowCreate(true);
          }}
          className="whitespace-nowrap"
        >
          Add Webhook
        </Button>
      </div>

      {/* Secret display banner */}
      {newSecret && (
        <Card>
          <Card.Body>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-text-primary font-medium">Signing Secret</p>
                <p className="text-text-muted text-sm">
                  Copy this secret now. It won&apos;t be shown again.
                </p>
                <code className="bg-surface-secondary mt-2 inline-block rounded px-3 py-1.5 font-mono text-sm">
                  {showSecret ? newSecret : "\u2022".repeat(40)}
                </code>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  leftIcon={showSecret ? EyeOff : Eye}
                  onClick={() => setShowSecret(!showSecret)}
                >
                  {showSecret ? "Hide" : "Show"}
                </Button>
                <Button size="sm" leftIcon={Copy} onClick={() => copyToClipboard(newSecret)}>
                  Copy
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setNewSecret(null);
                    setShowSecret(false);
                  }}
                >
                  Dismiss
                </Button>
              </div>
            </div>
          </Card.Body>
        </Card>
      )}

      {/* Webhook list */}
      {loading ? (
        <TableSkeleton rows={3} />
      ) : webhooks.length === 0 ? (
        <Card>
          <Card.Body>
            <EmptyState
              icon={Webhook}
              title="No Webhooks Configured"
              description="Set up webhooks to notify external services of events in OMG Teams."
              action={
                <Button
                  leftIcon={Plus}
                  onClick={() => {
                    resetForm();
                    setShowCreate(true);
                  }}
                  size="sm"
                >
                  Add First Webhook
                </Button>
              }
            />
          </Card.Body>
        </Card>
      ) : (
        <div className="space-y-3">
          {webhooks.map((wh) => (
            <Card key={wh.id}>
              <Card.Body>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-text-primary truncate font-mono text-sm font-medium">
                        {wh.url}
                      </p>
                      <Badge variant={wh.isActive ? "success" : "warning"} size="sm">
                        {wh.isActive ? "Active" : "Disabled"}
                      </Badge>
                    </div>
                    {wh.description && (
                      <p className="text-text-muted mt-1 text-sm">{wh.description}</p>
                    )}
                    <div className="mt-2 flex flex-wrap gap-1">
                      {wh.events.map((ev) => (
                        <Badge key={ev} variant="info" size="sm">
                          {ev}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => void handleTest(wh.id)}
                      disabled={testingId === wh.id}
                      className="text-text-muted hover:text-primary-500 rounded p-1.5 transition-colors"
                      title="Send test"
                    >
                      <Play size={14} />
                    </button>
                    <button
                      onClick={() => void handleToggleActive(wh)}
                      className="text-text-muted hover:text-warning-500 rounded p-1.5 transition-colors"
                      title={wh.isActive ? "Disable" : "Enable"}
                    >
                      {wh.isActive ? <XCircle size={14} /> : <CheckCircle2 size={14} />}
                    </button>
                    <button
                      onClick={() => void handleRotateSecret(wh.id)}
                      className="text-text-muted hover:text-primary-500 rounded p-1.5 transition-colors"
                      title="Rotate secret"
                    >
                      <RotateCw size={14} />
                    </button>
                    <button
                      onClick={() => openEdit(wh)}
                      className="text-text-muted hover:text-primary-500 rounded p-1.5 transition-colors"
                      title="Edit"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => setDeleteId(wh.id)}
                      className="text-text-muted hover:text-error-500 rounded p-1.5 transition-colors"
                      title="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </Card.Body>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal
        open={showCreate || !!editId}
        onClose={() => {
          setShowCreate(false);
          setEditId(null);
          resetForm();
        }}
        title={editId ? "Edit Webhook" : "Add Webhook"}
      >
        <div className="space-y-4">
          <FormField label="URL" htmlFor="webhook-url" required>
            <Input
              id="webhook-url"
              type="url"
              value={formUrl}
              onChange={(e) => setFormUrl(e.target.value)}
              placeholder="https://example.com/webhooks"
              autoFocus
            />
          </FormField>

          <FormField label="Description" htmlFor="webhook-desc">
            <Input
              id="webhook-desc"
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              placeholder="Optional description"
              maxLength={255}
              onKeyDown={(e) => {
                if (e.key === "Enter") void (editId ? handleUpdate() : handleCreate());
              }}
            />
          </FormField>

          <FormField label="Events" htmlFor="webhook-events" required>
            <div className="bg-surface-secondary max-h-60 space-y-1 overflow-y-auto rounded-lg border p-3">
              {availableEvents.map((event) => (
                <label
                  key={event}
                  className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 hover:bg-white/50"
                >
                  <Checkbox
                    checked={formEvents.includes(event)}
                    onChange={() => toggleEvent(event)}
                  />
                  <span className="text-text-primary font-mono text-sm">{event}</span>
                </label>
              ))}
            </div>
            <p className="text-text-muted mt-1 text-xs">{formEvents.length} events selected</p>
          </FormField>

          <div className="flex justify-end gap-3 pt-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowCreate(false);
                setEditId(null);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button
              loading={saving}
              disabled={!formUrl || formEvents.length === 0}
              onClick={() => void (editId ? handleUpdate() : handleCreate())}
            >
              {editId ? "Save Changes" : "Create Webhook"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete confirmation */}
      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => void handleDelete()}
        title="Delete Webhook"
        description="This webhook endpoint will be permanently deleted. Any external integrations using it will stop receiving events."
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  );
}
