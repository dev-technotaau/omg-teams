"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { qk } from "@/lib/query-keys";
import {
  FileText,
  Calendar,
  Clock,
  Users,
  Shield,
  Settings,
  BarChart3,
  Target,
  Bell,
  Mail,
  Volume2,
  Globe,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import { toast } from "sonner";
import {
  getMyPreferences,
  updateAllPreferences,
  type NotificationPreference,
} from "@/services/notification-preference.service";
import { PageHeader, Card, Switch, Button, Spinner } from "@/components/ui";
import { TimePicker } from "@/components/ui/time-picker";
import { useAuth } from "@/contexts/auth";
import { usePushNotifications } from "@/hooks/use-push-notifications";

// ──────────────────────────────────────────────
//  Notification Preferences Settings
// ──────────────────────────────────────────────

const CATEGORY_META: Record<string, { label: string; description: string; icon: typeof Bell }> = {
  DOCUMENT: {
    label: "Documents",
    description: "Upload status, verification, and expiry alerts",
    icon: FileText,
  },
  LEAVE: {
    label: "Leave",
    description: "Leave request approvals, rejections, and balance updates",
    icon: Calendar,
  },
  ATTENDANCE: {
    label: "Attendance",
    description: "Check-in/out reminders and attendance alerts",
    icon: Clock,
  },
  RECRUITMENT: {
    label: "Recruitment",
    description: "Candidate pipeline updates and report approvals",
    icon: Users,
  },
  ACCOUNT: {
    label: "Account",
    description: "Login alerts, password changes, and security notices",
    icon: Shield,
  },
  SYSTEM: {
    label: "System",
    description: "Platform updates, maintenance, and announcements",
    icon: Settings,
  },
  REPORT: {
    label: "Reports",
    description: "Report generation, delivery, and schedule alerts",
    icon: BarChart3,
  },
  TARGET: {
    label: "Targets",
    description: "Target assignments, progress, and achievement alerts",
    icon: Target,
  },
};

const CHANNELS = [
  { key: "isEnabled" as const, label: "In-App", icon: Bell },
  { key: "emailEnabled" as const, label: "Email", icon: Mail },
  { key: "soundEnabled" as const, label: "Sound", icon: Volume2 },
  { key: "browserPushEnabled" as const, label: "Browser Push", icon: Globe },
];

export default function NotificationPreferencesPage() {
  const { user } = useAuth();
  const { permission, enable: enablePush } = usePushNotifications(user?.id);
  const [preferences, setPreferences] = useState<NotificationPreference[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [original, setOriginal] = useState<NotificationPreference[]>([]);

  const prefsQuery = useQuery({
    queryKey: qk.notifPrefs.detail(),
    queryFn: getMyPreferences,
  });
  const isLoading = prefsQuery.isLoading;
  useEffect(() => {
    if (prefsQuery.data) {
      setPreferences(prefsQuery.data);
      setOriginal(JSON.parse(JSON.stringify(prefsQuery.data)));
      setHasChanges(false);
    }
    if (prefsQuery.isError) {
      toast.error("Failed to load notification preferences");
    }
  }, [prefsQuery.data, prefsQuery.isError]);

  const updatePref = (category: string, field: keyof NotificationPreference, value: boolean) => {
    // Request browser notification permission when enabling push for the first time
    if (field === "browserPushEnabled" && value && permission !== "granted") {
      void enablePush().then((granted) => {
        if (!granted) {
          toast.error("Browser notification permission denied. Enable it in browser settings.");
          return;
        }
        setPreferences((prev) =>
          prev.map((p) => (p.category === category ? { ...p, [field]: value } : p)),
        );
        setHasChanges(true);
      });
      return;
    }
    setPreferences((prev) =>
      prev.map((p) => (p.category === category ? { ...p, [field]: value } : p)),
    );
    setHasChanges(true);
  };

  const toggleAll = (enabled: boolean) => {
    if (enabled && permission !== "granted") {
      void enablePush();
    }
    setPreferences((prev) =>
      prev.map((p) => ({
        ...p,
        isEnabled: enabled,
        emailEnabled: enabled,
        soundEnabled: enabled,
        browserPushEnabled: enabled,
      })),
    );
    setHasChanges(true);
  };

  const allEnabled = preferences.every(
    (p) => p.isEnabled && p.emailEnabled && p.soundEnabled && p.browserPushEnabled,
  );

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const payload = preferences.map((p) => ({
        category: p.category,
        isEnabled: p.isEnabled,
        emailEnabled: p.emailEnabled,
        soundEnabled: p.soundEnabled,
        browserPushEnabled: p.browserPushEnabled,
      }));
      const updated = await updateAllPreferences(payload);
      setPreferences(updated);
      setOriginal(JSON.parse(JSON.stringify(updated)));
      setHasChanges(false);
      toast.success("Notification preferences saved");
    } catch {
      toast.error("Failed to save preferences");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Notification Preferences"
        description="Control how and when you receive notifications"
        actions={
          <Button onClick={() => void handleSave()} loading={isSaving} disabled={!hasChanges}>
            Save All
          </Button>
        }
      />

      {/* Master Toggle */}
      <Card padding="sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {allEnabled ? (
              <ToggleRight size={20} className="text-success-500" />
            ) : (
              <ToggleLeft size={20} className="text-text-muted" />
            )}
            <div>
              <div className="text-text-primary text-sm font-medium">
                {allEnabled ? "All notifications enabled" : "Some notifications disabled"}
              </div>
              <div className="text-text-muted text-xs">Toggle all categories at once</div>
            </div>
          </div>
          <Switch checked={allEnabled} onChange={(checked) => toggleAll(checked)} label="" />
        </div>
      </Card>

      {/* Category × Channel matrix — one row per category, one column per channel */}
      <Card padding="sm">
        <div className="-m-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-bg-muted border-border-default border-b">
              <tr>
                <th className="text-text-secondary px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider">
                  Category
                </th>
                {CHANNELS.map((ch) => {
                  const ChIcon = ch.icon;
                  return (
                    <th
                      key={ch.key}
                      className="text-text-secondary px-3 py-2.5 text-center text-xs font-medium uppercase tracking-wider"
                    >
                      <div className="inline-flex items-center gap-1.5">
                        <ChIcon size={13} />
                        <span>{ch.label}</span>
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-border-default divide-y">
              {preferences.map((pref) => {
                const meta = CATEGORY_META[pref.category];
                if (!meta) return null;
                const Icon = meta.icon;
                return (
                  <tr key={pref.category} className="hover:bg-bg-hover">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="bg-primary-100 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg">
                          <Icon size={15} className="text-primary-600" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-text-primary text-sm font-medium">
                            {meta.label}
                          </div>
                          <div className="text-text-muted truncate text-xs">
                            {meta.description}
                          </div>
                        </div>
                      </div>
                    </td>
                    {CHANNELS.map((ch) => (
                      <td key={ch.key} className="px-3 py-3 text-center">
                        <div className="inline-flex">
                          <Switch
                            checked={pref[ch.key]}
                            onChange={(checked) => updatePref(pref.category, ch.key, checked)}
                            size="sm"
                            label=""
                          />
                        </div>
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* §11.5 — Quiet Hours */}
      <Card padding="sm">
        <div className="space-y-3">
          <div>
            <div className="text-text-primary text-sm font-medium">Quiet Hours</div>
            <div className="text-text-muted text-xs">
              No sound or browser push notifications during these hours. In-app notifications still
              received silently.
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <label htmlFor="quietStart" className="text-text-secondary text-xs">
                From
              </label>
              <TimePicker id="quietStart" value="22:00" onChange={() => {}} size="sm" />
            </div>
            <span className="text-text-muted">to</span>
            <div className="flex items-center gap-2">
              <label htmlFor="quietEnd" className="text-text-secondary text-xs">
                Until
              </label>
              <TimePicker id="quietEnd" value="07:00" onChange={() => {}} size="sm" />
            </div>
          </div>
        </div>
      </Card>

      {/* Save footer (sticky) */}
      {hasChanges && (
        <div className="border-border-default bg-bg-surface sticky bottom-4 flex justify-end rounded-lg border p-3 shadow-lg">
          <div className="flex items-center gap-3">
            <span className="text-text-secondary text-sm">You have unsaved changes</span>
            <Button
              variant="outline"
              onClick={() => {
                setPreferences(JSON.parse(JSON.stringify(original)));
                setHasChanges(false);
              }}
            >
              Discard
            </Button>
            <Button onClick={() => void handleSave()} loading={isSaving}>
              Save Changes
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
