"use client";

// ──────────────────────────────────────────────
//  §Godview — Per-user administrative tabs
//  Rendered inside the Employee Detail page.
// ──────────────────────────────────────────────

import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Monitor,
  Key,
  ShieldCheck,
  History,
  Settings,
  Webhook,
  UserCog,
  Archive,
  Bell,
  FileOutput,
  Target as TargetIcon,
  ListChecks,
} from "lucide-react";
import { api } from "@/lib/api";
import { DataTable, TableSkeleton, Badge, Button, Modal, FormField, Input, Textarea } from "@/components/ui";
import type { Column } from "@/components/ui";

// ── Tab registry ───────────────────────────────────────────────
export const GODVIEW_TAB_IDS = [
  "sessions",
  "login-history",
  "audit",
  "notifications",
  "security",
  "targets",
  "offer-letters",
  "history",
  "webhooks",
  "impersonation",
  "preferences",
  "archive",
] as const;

export type GodviewTabId = (typeof GODVIEW_TAB_IDS)[number];

export const GODVIEW_TAB_ITEMS = [
  { id: "sessions" as const, label: "Sessions", icon: Monitor },
  { id: "login-history" as const, label: "Login History", icon: Key },
  { id: "audit" as const, label: "Audit Log", icon: ListChecks },
  { id: "notifications" as const, label: "Notifications", icon: Bell },
  { id: "security" as const, label: "Security", icon: ShieldCheck },
  { id: "targets" as const, label: "Targets", icon: TargetIcon },
  { id: "offer-letters" as const, label: "Offer Letters", icon: FileOutput },
  { id: "history" as const, label: "History", icon: History },
  { id: "webhooks" as const, label: "Webhooks", icon: Webhook },
  { id: "impersonation" as const, label: "Impersonation", icon: UserCog },
  { id: "preferences" as const, label: "Preferences", icon: Settings },
  { id: "archive" as const, label: "Archive", icon: Archive },
];

// ── Utility hook: paginated fetch (TanStack Query backed) ──────
// Same return shape as before (data/loading/error/reload), but the cache,
// background refetch, and dedup all come from React Query. The query key
// is the URL itself which is sufficient since each tab's data is unique
// to the user being viewed (the userId is in the URL).
function usePaginatedList<T>(url: string | null) {
  const query = useQuery({
    queryKey: ["godview", url] as const,
    queryFn: async () => {
      if (!url) return [] as T[];
      const res = await api.get<{ data: T[] }>(url);
      return res.data.data ?? [];
    },
    enabled: !!url,
  });
  const reload = useCallback(() => query.refetch(), [query]);
  return {
    data: (query.data ?? []) as T[],
    loading: query.isLoading,
    error: query.error ? (query.error as Error).message : null,
    reload,
  };
}

/** Shared error banner for godview tabs */
function TabError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="border-error-200 bg-error-50 dark:border-error-800 dark:bg-error-950/30 flex items-center justify-between gap-3 rounded-lg border p-4">
      <p className="text-error-700 dark:text-error-400 text-sm">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  );
}

function fmtDate(d: string | null | undefined) {
  if (!d) return "\u2014";
  return new Date(d).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ══════════════════════════════════════════════
//  Individual tab components
// ══════════════════════════════════════════════

// ── Sessions ──────────────────────────────────────────────────
interface AdminSession {
  id: string;
  deviceId: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  lastActiveAt: string;
}

function SessionsTab({ userId }: { userId: string }) {
  const { data, loading, error, reload } = usePaginatedList<AdminSession>(
    `/admin/sessions?userId=${userId}`,
  );
  const revoke = async (id: string) => {
    try {
      await api.delete(`/admin/sessions/${id}`);
      toast.success("Session revoked");
      void reload();
    } catch {
      toast.error("Failed to revoke session");
    }
  };
  const cols: Column<AdminSession>[] = [
    { key: "deviceId", header: "Device", cell: (r) => r.deviceId.slice(0, 12) + "..." },
    { key: "ipAddress", header: "IP", cell: (r) => r.ipAddress ?? "\u2014" },
    {
      key: "userAgent",
      header: "User Agent",
      cell: (r) => <span className="text-xs">{(r.userAgent ?? "\u2014").slice(0, 40)}</span>,
    },
    { key: "createdAt", header: "Created", cell: (r) => fmtDate(r.createdAt) },
    { key: "lastActiveAt", header: "Last Active", cell: (r) => fmtDate(r.lastActiveAt) },
    {
      key: "actions",
      header: "",
      cell: (r) => (
        <Button variant="ghost" size="sm" onClick={() => void revoke(r.id)}>
          Revoke
        </Button>
      ),
    },
  ];
  if (loading) return <TableSkeleton />;
  if (error) return <TabError message={error} onRetry={reload} />;
  return <DataTable columns={cols} data={data} emptyTitle="No active sessions" />;
}

// ── Login History ─────────────────────────────────────────────
interface LoginAttempt {
  id: string;
  attemptedId: string | null;
  ip: string | null;
  userAgent: string | null;
  success: boolean;
  failureReason: string | null;
  loginMethod: string;
  createdAt: string;
}

function LoginHistoryTab({ userId }: { userId: string }) {
  const { data, loading, error, reload } = usePaginatedList<LoginAttempt>(`/users/${userId}/login-history`);
  const cols: Column<LoginAttempt>[] = [
    { key: "createdAt", header: "When", cell: (r) => fmtDate(r.createdAt) },
    {
      key: "success",
      header: "Result",
      cell: (r) => (
        <Badge variant={r.success ? "success" : "danger"}>{r.success ? "Success" : "Failed"}</Badge>
      ),
    },
    { key: "loginMethod", header: "Method", cell: (r) => r.loginMethod },
    { key: "ip", header: "IP", cell: (r) => r.ip ?? "\u2014" },
    {
      key: "failureReason",
      header: "Reason",
      cell: (r) => <span className="text-xs text-text-muted">{r.failureReason ?? "\u2014"}</span>,
    },
  ];
  if (loading) return <TableSkeleton />;
  if (error) return <TabError message={error} onRetry={reload} />;
  return <DataTable columns={cols} data={data} emptyTitle="No login attempts recorded" />;
}

// ── Audit Log ─────────────────────────────────────────────────
interface AuditEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  changes: unknown;
  ipAddress: string | null;
  timestamp: string;
}

function AuditTab({ userId }: { userId: string }) {
  const { data, loading, error, reload } = usePaginatedList<AuditEntry>(`/audit-logs?userId=${userId}`);
  const cols: Column<AuditEntry>[] = [
    { key: "timestamp", header: "When", cell: (r) => fmtDate(r.timestamp) },
    { key: "action", header: "Action", cell: (r) => <Badge variant="default">{r.action}</Badge> },
    { key: "entityType", header: "Entity", cell: (r) => r.entityType.replace(/_/g, " ") },
    { key: "entityId", header: "Entity ID", cell: (r) => <code className="text-xs">{r.entityId.slice(0, 10)}</code> },
    { key: "ipAddress", header: "IP", cell: (r) => r.ipAddress ?? "\u2014" },
  ];
  if (loading) return <TableSkeleton />;
  if (error) return <TabError message={error} onRetry={reload} />;
  return (
    <DataTable
      columns={cols}
      data={data}
      emptyTitle="No audit entries"
      detailTitle={(r) => `${r.action} — ${r.entityType.replace(/_/g, " ")}`}
      detailRenderer={(r) => (
        <div className="space-y-3">
          <div>
            <div className="text-text-muted text-xs uppercase tracking-wider">When</div>
            <div className="text-text-primary text-sm">{fmtDate(r.timestamp)}</div>
          </div>
          <div>
            <div className="text-text-muted text-xs uppercase tracking-wider">Entity ID</div>
            <code className="text-text-primary text-xs">{r.entityId}</code>
          </div>
          <div>
            <div className="text-text-muted text-xs uppercase tracking-wider">IP Address</div>
            <div className="text-text-primary text-sm">{r.ipAddress ?? "\u2014"}</div>
          </div>
          <div>
            <div className="text-text-muted text-xs uppercase tracking-wider">Changes</div>
            <pre className="bg-bg-muted text-text-primary mt-1 max-h-80 overflow-auto rounded-md p-3 text-xs">
              {r.changes ? JSON.stringify(r.changes, null, 2) : "(no change payload)"}
            </pre>
          </div>
        </div>
      )}
    />
  );
}

// ── Notifications ─────────────────────────────────────────────
interface NotifRow {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  isCleared: boolean;
  createdAt: string;
}

function NotificationsTab({ userId }: { userId: string }) {
  const { data, loading, error, reload } = usePaginatedList<NotifRow>(`/users/${userId}/notifications`);
  const cols: Column<NotifRow>[] = [
    { key: "createdAt", header: "When", cell: (r) => fmtDate(r.createdAt) },
    { key: "type", header: "Type", cell: (r) => <Badge variant="default">{r.type}</Badge> },
    { key: "title", header: "Title", cell: (r) => r.title },
    {
      key: "status",
      header: "Status",
      cell: (r) => (
        <div className="flex gap-1">
          {r.isRead && <Badge variant="success">Read</Badge>}
          {!r.isRead && <Badge variant="warning">Unread</Badge>}
          {r.isCleared && <Badge variant="default">Cleared</Badge>}
        </div>
      ),
    },
  ];
  if (loading) return <TableSkeleton />;
  if (error) return <TabError message={error} onRetry={reload} />;
  return <DataTable columns={cols} data={data} emptyTitle="No notifications" />;
}

// ── Security (Auth Methods) ───────────────────────────────────
interface AuthMethods {
  webauthnCredentials: Array<{
    id: string;
    credentialId: string;
    deviceName: string | null;
    transports: string[];
    lastUsedAt: string | null;
    createdAt: string;
  }>;
  backupCodes: { total: number; used: number; remaining: number };
  mfaEnrolled: boolean;
}

function SecurityTab({ userId }: { userId: string }) {
  const securityQuery = useQuery({
    queryKey: ["godview", "security", userId] as const,
    queryFn: async () => {
      const res = await api.get<AuthMethods>(`/users/${userId}/auth-methods`);
      return res.data;
    },
  });
  const info = securityQuery.data ?? null;
  const loading = securityQuery.isLoading;
  const load = useCallback(() => securityQuery.refetch(), [securityQuery]);

  const handleResetMfa = async () => {
    if (
      !confirm(
        "Reset MFA? All WebAuthn credentials and backup codes will be deleted. User will need to re-enroll.",
      )
    )
      return;
    try {
      const res = await api.post<{ webauthn: number; backup: number }>(
        `/users/${userId}/reset-mfa`,
        {},
      );
      toast.success(
        `MFA reset: ${res.data.webauthn} credential(s), ${res.data.backup} backup code(s) removed`,
      );
      void load();
    } catch {
      toast.error("Failed to reset MFA");
    }
  };

  if (loading || !info) return <TableSkeleton />;
  if (securityQuery.error) return <TabError message={(securityQuery.error as Error).message} onRetry={() => void load()} />;
  return (
    <div className="space-y-4">
      <div className="border-border-default flex items-start justify-between gap-4 rounded-lg border p-4">
        <div>
          <div className="text-text-muted text-xs uppercase tracking-wider">MFA Status</div>
          <div className="mt-1 flex items-center gap-2">
            <Badge variant={info.mfaEnrolled ? "success" : "warning"}>
              {info.mfaEnrolled ? "Enrolled" : "Not Enrolled"}
            </Badge>
            <span className="text-text-secondary text-sm">
              {info.webauthnCredentials.length} WebAuthn credential(s),{" "}
              {info.backupCodes.remaining} / {info.backupCodes.total} backup codes remaining
            </span>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => void handleResetMfa()}>
          Reset MFA
        </Button>
      </div>

      <div className="border-border-default rounded-lg border">
        <div className="border-border-default border-b px-4 py-3">
          <h4 className="text-text-primary text-sm font-semibold">WebAuthn Credentials</h4>
        </div>
        <div className="divide-border-default divide-y">
          {info.webauthnCredentials.length === 0 ? (
            <div className="text-text-muted px-4 py-6 text-center text-sm">No credentials registered</div>
          ) : (
            info.webauthnCredentials.map((c) => (
              <div key={c.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <div className="text-text-primary text-sm font-medium">
                    {c.deviceName ?? "Unnamed device"}
                  </div>
                  <div className="text-text-muted text-xs">
                    Created {fmtDate(c.createdAt)} · Last used {fmtDate(c.lastUsedAt)}
                  </div>
                </div>
                <div className="text-text-muted text-xs">
                  {c.transports.join(", ") || "\u2014"}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ── Targets ───────────────────────────────────────────────────
interface TargetRow {
  id: string;
  targetType: string;
  targetValue: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  isActive: boolean;
  createdAt: string;
}

function TargetsTab({ userId }: { userId: string }) {
  const { data, loading, error, reload } = usePaginatedList<TargetRow>(`/targets?recruiterId=${userId}`);
  const cols: Column<TargetRow>[] = [
    { key: "targetType", header: "Type", cell: (r) => <Badge variant="default">{r.targetType}</Badge> },
    { key: "targetValue", header: "Value", cell: (r) => r.targetValue },
    { key: "effectiveFrom", header: "From", cell: (r) => fmtDate(r.effectiveFrom) },
    { key: "effectiveTo", header: "To", cell: (r) => fmtDate(r.effectiveTo) },
    {
      key: "isActive",
      header: "Status",
      cell: (r) => (
        <Badge variant={r.isActive ? "success" : "default"}>
          {r.isActive ? "Active" : "Inactive"}
        </Badge>
      ),
    },
  ];
  if (loading) return <TableSkeleton />;
  if (error) return <TabError message={error} onRetry={reload} />;
  return <DataTable columns={cols} data={data} emptyTitle="No targets assigned" />;
}

// ── Offer Letters ─────────────────────────────────────────────
interface OfferLetterRow {
  id: string;
  referenceNumber: string;
  variant: string;
  isArchived: boolean;
  createdAt: string;
}

function OfferLettersTab({ userId }: { userId: string }) {
  const { data, loading, error, reload } = usePaginatedList<OfferLetterRow>(`/offer-letters?userId=${userId}`);
  const cols: Column<OfferLetterRow>[] = [
    { key: "referenceNumber", header: "Reference", cell: (r) => <code className="text-xs">{r.referenceNumber}</code> },
    { key: "variant", header: "Variant", cell: (r) => <Badge variant="default">{r.variant}</Badge> },
    { key: "createdAt", header: "Generated", cell: (r) => fmtDate(r.createdAt) },
    {
      key: "isArchived",
      header: "Status",
      cell: (r) => (
        <Badge variant={r.isArchived ? "default" : "success"}>
          {r.isArchived ? "Archived" : "Active"}
        </Badge>
      ),
    },
  ];
  if (loading) return <TableSkeleton />;
  if (error) return <TabError message={error} onRetry={reload} />;
  return <DataTable columns={cols} data={data} emptyTitle="No offer letters generated" />;
}

// ── History (leave balance + document + password) ────────────
interface LeaveBalanceHistoryRow {
  id: string;
  changeType: string;
  changeAmount: number;
  balanceBefore: number;
  balanceAfter: number;
  reason: string | null;
  createdAt: string;
  leaveBalance?: { leaveType?: { name: string | null } | null } | null;
  changer?: { firstName: string; lastName: string } | null;
}
interface DocumentHistoryRow {
  id: string;
  action: string;
  oldStatus: string | null;
  newStatus: string | null;
  reason: string | null;
  createdAt: string;
  document?: { documentType?: { name: string | null } | null } | null;
  actor?: { firstName: string; lastName: string } | null;
}
interface PasswordHistoryRow {
  id: string;
  reason: string | null;
  changedBy: string | null;
  createdAt: string;
}

function HistoryTab({ userId }: { userId: string }) {
  const leave = usePaginatedList<LeaveBalanceHistoryRow>(`/users/${userId}/leave-balance-history`);
  const docs = usePaginatedList<DocumentHistoryRow>(`/users/${userId}/document-history`);
  const pwd = usePaginatedList<PasswordHistoryRow>(`/users/${userId}/password-history`);

  const leaveCols: Column<LeaveBalanceHistoryRow>[] = [
    { key: "createdAt", header: "When", cell: (r) => fmtDate(r.createdAt) },
    {
      key: "leaveType",
      header: "Type",
      cell: (r) => r.leaveBalance?.leaveType?.name ?? "\u2014",
    },
    { key: "changeType", header: "Change", cell: (r) => <Badge variant="default">{r.changeType}</Badge> },
    { key: "amount", header: "Amount", cell: (r) => r.changeAmount },
    { key: "balance", header: "Balance", cell: (r) => `${r.balanceBefore} → ${r.balanceAfter}` },
    {
      key: "by",
      header: "By",
      cell: (r) => (r.changer ? `${r.changer.firstName} ${r.changer.lastName}` : "System"),
    },
  ];
  const docCols: Column<DocumentHistoryRow>[] = [
    { key: "createdAt", header: "When", cell: (r) => fmtDate(r.createdAt) },
    { key: "docType", header: "Document", cell: (r) => r.document?.documentType?.name ?? "\u2014" },
    { key: "action", header: "Action", cell: (r) => <Badge variant="default">{r.action}</Badge> },
    {
      key: "transition",
      header: "Status",
      cell: (r) => `${r.oldStatus ?? "\u2014"} → ${r.newStatus ?? "\u2014"}`,
    },
    {
      key: "by",
      header: "By",
      cell: (r) => (r.actor ? `${r.actor.firstName} ${r.actor.lastName}` : "System"),
    },
  ];
  const pwdCols: Column<PasswordHistoryRow>[] = [
    { key: "createdAt", header: "When", cell: (r) => fmtDate(r.createdAt) },
    { key: "reason", header: "Reason", cell: (r) => r.reason ?? "\u2014" },
    {
      key: "changedBy",
      header: "Changed By",
      cell: (r) => (r.changedBy ? r.changedBy.slice(0, 10) + "..." : "Self"),
    },
  ];

  return (
    <div className="space-y-6">
      <section>
        <h3 className="text-text-primary mb-2 text-sm font-semibold">Leave Balance History</h3>
        {leave.loading ? (
          <TableSkeleton />
        ) : leave.error ? (
          <TabError message={leave.error} onRetry={leave.reload} />
        ) : (
          <DataTable columns={leaveCols} data={leave.data} emptyTitle="No leave balance changes" />
        )}
      </section>
      <section>
        <h3 className="text-text-primary mb-2 text-sm font-semibold">Document History</h3>
        {docs.loading ? (
          <TableSkeleton />
        ) : docs.error ? (
          <TabError message={docs.error} onRetry={docs.reload} />
        ) : (
          <DataTable columns={docCols} data={docs.data} emptyTitle="No document changes" />
        )}
      </section>
      <section>
        <h3 className="text-text-primary mb-2 text-sm font-semibold">Password History</h3>
        {pwd.loading ? (
          <TableSkeleton />
        ) : pwd.error ? (
          <TabError message={pwd.error} onRetry={pwd.reload} />
        ) : (
          <DataTable columns={pwdCols} data={pwd.data} emptyTitle="No password changes" />
        )}
      </section>
    </div>
  );
}

// ── Webhooks (CRUD) ───────────────────────────────────────────
interface WebhookRow {
  id: string;
  url: string;
  events: string[];
  description: string | null;
  isActive: boolean;
  lastDeliveryAt: string | null;
  failureCount: number;
  createdAt: string;
}

function WebhooksTab({ userId }: { userId: string }) {
  const { data, loading, error, reload } = usePaginatedList<WebhookRow>(
    `/users/${userId}/webhook-subscriptions`,
  );
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ url: "", secret: "", events: "", description: "" });
  const [saving, setSaving] = useState(false);

  const create = async () => {
    if (!form.url || !form.secret || !form.events) {
      toast.error("URL, secret, and events are required");
      return;
    }
    setSaving(true);
    try {
      await api.post(`/users/${userId}/webhook-subscriptions`, {
        url: form.url,
        secret: form.secret,
        events: form.events.split(",").map((s) => s.trim()).filter(Boolean),
        description: form.description || null,
      });
      toast.success("Webhook created");
      setShowCreate(false);
      setForm({ url: "", secret: "", events: "", description: "" });
      void reload();
    } catch {
      toast.error("Failed to create webhook");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this webhook subscription?")) return;
    try {
      await api.delete(`/users/${userId}/webhook-subscriptions/${id}`);
      toast.success("Webhook deleted");
      void reload();
    } catch {
      toast.error("Failed to delete");
    }
  };

  const toggle = async (row: WebhookRow) => {
    try {
      await api.patch(`/users/${userId}/webhook-subscriptions/${row.id}`, {
        isActive: !row.isActive,
      });
      void reload();
    } catch {
      toast.error("Failed to update");
    }
  };

  const cols: Column<WebhookRow>[] = [
    { key: "url", header: "URL", cell: (r) => <span className="text-xs">{r.url}</span> },
    {
      key: "events",
      header: "Events",
      cell: (r) => <span className="text-xs">{r.events.join(", ") || "\u2014"}</span>,
    },
    {
      key: "isActive",
      header: "Status",
      cell: (r) => (
        <Badge variant={r.isActive ? "success" : "default"}>
          {r.isActive ? "Active" : "Disabled"}
        </Badge>
      ),
    },
    { key: "failures", header: "Failures", cell: (r) => r.failureCount },
    { key: "lastDelivery", header: "Last Delivery", cell: (r) => fmtDate(r.lastDeliveryAt) },
    {
      key: "actions",
      header: "",
      cell: (r) => (
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={() => void toggle(r)}>
            {r.isActive ? "Disable" : "Enable"}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => void remove(r.id)}>
            Delete
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button leftIcon={Webhook} onClick={() => setShowCreate(true)}>
          New Webhook
        </Button>
      </div>
      {loading ? (
        <TableSkeleton />
      ) : error ? (
        <TabError message={error} onRetry={reload} />
      ) : (
        <DataTable columns={cols} data={data} emptyTitle="No webhooks configured" />
      )}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="New Webhook Subscription" size="md">
        <div className="space-y-3">
          <FormField label="URL" htmlFor="wh-url" required>
            <Input
              id="wh-url"
              value={form.url}
              onChange={(e) => setForm({ ...form, url: e.target.value })}
              placeholder="https://example.com/hook"
            />
          </FormField>
          <FormField label="Secret" htmlFor="wh-secret" required>
            <Input
              id="wh-secret"
              value={form.secret}
              onChange={(e) => setForm({ ...form, secret: e.target.value })}
              placeholder="HMAC signing secret"
            />
          </FormField>
          <FormField label="Events (comma-separated)" htmlFor="wh-events" required>
            <Input
              id="wh-events"
              value={form.events}
              onChange={(e) => setForm({ ...form, events: e.target.value })}
              placeholder="candidate.created, report.verified"
            />
          </FormField>
          <FormField label="Description" htmlFor="wh-desc">
            <Textarea
              id="wh-desc"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={2}
            />
          </FormField>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
            <Button onClick={() => void create()} disabled={saving}>
              {saving ? "Creating..." : "Create"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ── Impersonation ─────────────────────────────────────────────
interface ImpRow {
  id: string;
  reason: string;
  ipAddress: string | null;
  startedAt: string;
  endedAt: string | null;
  admin: { firstName: string; lastName: string; email: string };
  target: { firstName: string; lastName: string; email: string };
}

function ImpersonationTab({ userId }: { userId: string }) {
  const { data, loading, error, reload } = usePaginatedList<ImpRow>(
    `/users/${userId}/impersonation-sessions`,
  );
  const [showStart, setShowStart] = useState(false);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const start = async () => {
    if (reason.length < 5) {
      toast.error("Reason must be at least 5 characters");
      return;
    }
    setSaving(true);
    try {
      await api.post(`/users/${userId}/impersonate`, { reason });
      toast.success("Impersonation session logged");
      setShowStart(false);
      setReason("");
      void reload();
    } catch {
      toast.error("Failed to start impersonation");
    } finally {
      setSaving(false);
    }
  };

  const endSession = async (id: string) => {
    try {
      await api.post(`/users/${userId}/impersonate/${id}/end`, {});
      toast.success("Impersonation ended");
      void reload();
    } catch {
      toast.error("Failed to end session");
    }
  };

  const cols: Column<ImpRow>[] = [
    { key: "startedAt", header: "Started", cell: (r) => fmtDate(r.startedAt) },
    { key: "endedAt", header: "Ended", cell: (r) => fmtDate(r.endedAt) },
    { key: "admin", header: "Admin", cell: (r) => `${r.admin.firstName} ${r.admin.lastName}` },
    { key: "target", header: "Target", cell: (r) => `${r.target.firstName} ${r.target.lastName}` },
    { key: "reason", header: "Reason", cell: (r) => <span className="text-xs">{r.reason}</span> },
    { key: "ipAddress", header: "IP", cell: (r) => r.ipAddress ?? "\u2014" },
    {
      key: "actions",
      header: "",
      cell: (r) =>
        !r.endedAt ? (
          <Button variant="ghost" size="sm" onClick={() => void endSession(r.id)}>
            End
          </Button>
        ) : null,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button leftIcon={UserCog} onClick={() => setShowStart(true)}>
          Start Impersonation
        </Button>
      </div>
      {loading ? (
        <TableSkeleton />
      ) : error ? (
        <TabError message={error} onRetry={reload} />
      ) : (
        <DataTable columns={cols} data={data} emptyTitle="No impersonation sessions" />
      )}
      <Modal open={showStart} onClose={() => setShowStart(false)} title="Start Impersonation" size="sm">
        <div className="space-y-3">
          <p className="text-text-secondary text-sm">
            Impersonation is logged and audited. Provide a clear reason (≥5 chars).
          </p>
          <FormField label="Reason" htmlFor="imp-reason" required>
            <Textarea
              id="imp-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="e.g. Debugging attendance sync issue reported in ticket #1234"
            />
          </FormField>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowStart(false)}>
              Cancel
            </Button>
            <Button onClick={() => void start()} disabled={saving}>
              {saving ? "Starting..." : "Start"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ── Preferences (table prefs + filter presets) ────────────────
interface TablePref {
  id: string;
  tableKey: string;
  density: string | null;
  pageSize: number | null;
  viewType: string | null;
  columns: unknown;
  updatedAt: string;
}
interface FilterPreset {
  id: string;
  pageKey: string;
  name: string;
  isDefault: boolean;
  filters: unknown;
  updatedAt: string;
}

function PreferencesTab({ userId }: { userId: string }) {
  const prefs = usePaginatedList<TablePref>(`/users/${userId}/table-preferences`);
  const presets = usePaginatedList<FilterPreset>(`/users/${userId}/filter-presets`);

  const prefCols: Column<TablePref>[] = [
    { key: "tableKey", header: "Table", cell: (r) => <code className="text-xs">{r.tableKey}</code> },
    { key: "density", header: "Density", cell: (r) => r.density ?? "\u2014" },
    { key: "pageSize", header: "Page Size", cell: (r) => r.pageSize ?? "\u2014" },
    { key: "viewType", header: "View", cell: (r) => r.viewType ?? "\u2014" },
    { key: "updatedAt", header: "Updated", cell: (r) => fmtDate(r.updatedAt) },
  ];
  const presetCols: Column<FilterPreset>[] = [
    { key: "pageKey", header: "Page", cell: (r) => <code className="text-xs">{r.pageKey}</code> },
    { key: "name", header: "Name", cell: (r) => r.name },
    {
      key: "isDefault",
      header: "Default",
      cell: (r) => (r.isDefault ? <Badge variant="success">Yes</Badge> : "\u2014"),
    },
    { key: "updatedAt", header: "Updated", cell: (r) => fmtDate(r.updatedAt) },
  ];

  return (
    <div className="space-y-6">
      <section>
        <h3 className="text-text-primary mb-2 text-sm font-semibold">Table Preferences</h3>
        {prefs.loading ? (
          <TableSkeleton />
        ) : prefs.error ? (
          <TabError message={prefs.error} onRetry={prefs.reload} />
        ) : (
          <DataTable columns={prefCols} data={prefs.data} emptyTitle="No saved table preferences" />
        )}
      </section>
      <section>
        <h3 className="text-text-primary mb-2 text-sm font-semibold">Filter Presets</h3>
        {presets.loading ? (
          <TableSkeleton />
        ) : presets.error ? (
          <TabError message={presets.error} onRetry={presets.reload} />
        ) : (
          <DataTable columns={presetCols} data={presets.data} emptyTitle="No saved filter presets" />
        )}
      </section>
    </div>
  );
}

// ── Archive ──────────────────────────────────────────────────
interface ArchiveRow {
  id: string;
  entityType: string;
  entityId: string;
  archivedAt: string;
  actorId: string | null;
  relatedUserId: string | null;
}

function ArchiveTab({ userId }: { userId: string }) {
  const { data, loading, error, reload } = usePaginatedList<ArchiveRow>(`/users/${userId}/archive-entries`);
  const cols: Column<ArchiveRow>[] = [
    { key: "archivedAt", header: "Archived", cell: (r) => fmtDate(r.archivedAt) },
    { key: "entityType", header: "Type", cell: (r) => <Badge variant="default">{r.entityType}</Badge> },
    { key: "entityId", header: "Entity ID", cell: (r) => <code className="text-xs">{r.entityId.slice(0, 12)}</code> },
    {
      key: "role",
      header: "Role",
      cell: (r) =>
        r.actorId === userId ? (
          <Badge variant="default">Actor</Badge>
        ) : (
          <Badge variant="default">Subject</Badge>
        ),
    },
  ];
  if (loading) return <TableSkeleton />;
  if (error) return <TabError message={error} onRetry={reload} />;
  return <DataTable columns={cols} data={data} emptyTitle="No archive entries" />;
}

// ══════════════════════════════════════════════
//  Entry-point component — routes to the right tab
// ══════════════════════════════════════════════
export function GodviewTab({ tab, userId }: { tab: GodviewTabId; userId: string }) {
  switch (tab) {
    case "sessions":
      return <SessionsTab userId={userId} />;
    case "login-history":
      return <LoginHistoryTab userId={userId} />;
    case "audit":
      return <AuditTab userId={userId} />;
    case "notifications":
      return <NotificationsTab userId={userId} />;
    case "security":
      return <SecurityTab userId={userId} />;
    case "targets":
      return <TargetsTab userId={userId} />;
    case "offer-letters":
      return <OfferLettersTab userId={userId} />;
    case "history":
      return <HistoryTab userId={userId} />;
    case "webhooks":
      return <WebhooksTab userId={userId} />;
    case "impersonation":
      return <ImpersonationTab userId={userId} />;
    case "preferences":
      return <PreferencesTab userId={userId} />;
    case "archive":
      return <ArchiveTab userId={userId} />;
    default:
      return null;
  }
}
