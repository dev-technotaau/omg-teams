"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Save,
  Settings,
  AlertTriangle,
  Power,
  Flag,
  FileSignature,
  Upload,
  Trash2,
} from "lucide-react";
import Image from "next/image";
import { toast } from "sonner";
import { api, extractApiError } from "@/lib/api";
import { getAllFlags } from "@/services/feature-flag.service";
import { uploadSignatureImage, deleteSignatureImage } from "@/services/upload.service";
import { settingValueSchema } from "@/validators/settings";
import type { SettingItem, SettingFieldDef } from "@/types/setting";
import {
  PageHeader,
  Card,
  Input,
  Select,
  Switch,
  FormField,
  Button,
  TableSkeleton,
} from "@/components/ui";
import { CalendarDatePicker } from "@/components/ui/calendar-date-picker";
import { TimePicker } from "@/components/ui/time-picker";

// ──────────────────────────────────────────────
//  Platform Settings — Spec Section 23.12
//  Categorized settings with per-section save
// ──────────────────────────────────────────────

const CATEGORIES = [
  { key: "general", label: "General" },
  { key: "maintenance", label: "Maintenance" },
  { key: "session", label: "Session & Security" },
  { key: "attendance", label: "Attendance" },
  { key: "leave", label: "Leave" },
  { key: "reports", label: "Reports" },
  { key: "invoice", label: "Invoice" },
  { key: "data", label: "Data Management" },
  { key: "zone", label: "Zone Configuration" },
  { key: "notification", label: "Notifications" },
  { key: "offer_letter", label: "Offer Letter" },
  { key: "feature-flags", label: "Feature Flags" },
] as const;

type FieldDef = SettingFieldDef;

const FIELD_DEFS: FieldDef[] = [
  // General
  {
    key: "platform_name",
    label: "Platform Name",
    description: "The display name for this platform",
    type: "text",
    category: "general",
  },
  // Session & Security
  {
    key: "idle_timeout_minutes",
    label: "Idle Timeout (minutes)",
    description: "Auto-logout after inactivity",
    type: "number",
    category: "session",
  },
  {
    key: "lockout_threshold",
    label: "Lockout Threshold",
    description: "Failed login attempts before lockout",
    type: "number",
    category: "session",
  },
  {
    key: "lockout_duration_minutes",
    label: "Lockout Duration (minutes)",
    description: "How long accounts stay locked",
    type: "number",
    category: "session",
  },
  {
    key: "password_min_length",
    label: "Password Min Length",
    description: "Minimum characters for passwords",
    type: "number",
    category: "session",
  },
  // Attendance
  {
    key: "expected_login_time",
    label: "Expected Login Time",
    description: "Default expected check-in time",
    type: "time",
    category: "attendance",
  },
  {
    key: "grace_period_minutes",
    label: "Grace Period (minutes)",
    description: "Minutes after expected time before marked late",
    type: "number",
    category: "attendance",
  },
  {
    key: "absent_threshold_minutes",
    label: "Absent Threshold (minutes)",
    description: "Minutes late before marked absent",
    type: "number",
    category: "attendance",
  },
  {
    key: "half_day_threshold_minutes",
    label: "Half-Day Threshold (minutes)",
    description: "Minutes late to count as half day",
    type: "number",
    category: "attendance",
  },
  {
    key: "working_days",
    label: "Working Days",
    description: "Comma-separated working days (e.g. Mon,Tue,Wed,Thu,Fri,Sat)",
    type: "text",
    category: "attendance",
  },
  {
    key: "standard_day_minutes",
    label: "Standard Day (minutes)",
    description: "Standard working day length for overtime calculation (e.g. 480 = 8 hours)",
    type: "number",
    category: "attendance",
  },
  {
    key: "break_deduction_minutes",
    label: "Break Deduction (minutes)",
    description:
      "Automatic break deduction from gross hours (e.g. 60 = 1 hour lunch). Set 0 to disable.",
    type: "number",
    category: "attendance",
  },
  {
    key: "excessive_late_threshold",
    label: "Excessive Late Threshold",
    description: "Late logins per month before admin alert triggers (default: 5)",
    type: "number",
    category: "attendance",
  },
  // Leave
  {
    key: "leave_casual_default",
    label: "Casual Leave Allotment",
    description: "Default annual casual leaves",
    type: "number",
    category: "leave",
  },
  {
    key: "leave_sick_default",
    label: "Sick Leave Allotment",
    description: "Default annual sick leaves",
    type: "number",
    category: "leave",
  },
  {
    key: "leave_earned_default",
    label: "Earned Leave Allotment",
    description: "Default annual earned leaves",
    type: "number",
    category: "leave",
  },
  {
    key: "leave_carry_forward",
    label: "Carry Forward",
    description: "Allow unused leaves to carry over to next year",
    type: "toggle",
    category: "leave",
  },
  {
    key: "leave_negative_balance",
    label: "Negative Balance",
    description: "Allow leave applications beyond balance",
    type: "toggle",
    category: "leave",
  },
  {
    key: "leave_low_balance_threshold",
    label: "Low Balance Warning (days)",
    description: "Notify employee when balance drops below this",
    type: "number",
    category: "leave",
  },
  {
    key: "leave_carry_forward_casual_max",
    label: "Carry Forward CL Max (days)",
    description: "Max casual leave days carried to next year (0 = none)",
    type: "number",
    category: "leave",
  },
  {
    key: "leave_carry_forward_earned_max",
    label: "Carry Forward EL Max (days)",
    description: "Max earned leave days carried to next year (0 = none)",
    type: "number",
    category: "leave",
  },
  {
    key: "leave_year_reset_date",
    label: "Annual Reset Date",
    description: "Date when balances reset yearly (e.g. 01-01 for Jan 1)",
    type: "text",
    category: "leave",
  },
  // Reports
  {
    key: "report_retention_days",
    label: "File Retention (days)",
    description: "Days to retain generated report files",
    type: "number",
    category: "reports",
  },
  {
    key: "report_default_schedule_time",
    label: "Default Schedule Time",
    description: "Default time for scheduled reports",
    type: "time",
    category: "reports",
  },
  // Invoice
  {
    key: "invoice_prefix",
    label: "Invoice Prefix",
    description: "Prefix for invoice numbers (e.g. INV-)",
    type: "text",
    category: "invoice",
  },
  {
    key: "invoice_date_format",
    label: "Date Format",
    description: "Date format used on invoices",
    type: "select",
    category: "invoice",
    options: [
      { label: "DD/MM/YYYY", value: "DD/MM/YYYY" },
      { label: "MM/DD/YYYY", value: "MM/DD/YYYY" },
      { label: "YYYY-MM-DD", value: "YYYY-MM-DD" },
    ],
  },
  {
    key: "invoice_starting_serial",
    label: "Starting Serial",
    description: "Starting number for invoice serial",
    type: "number",
    category: "invoice",
  },
  // Data Management
  {
    key: "archive_threshold_months",
    label: "Archive Threshold (months)",
    description: "Months before data is auto-archived",
    type: "number",
    category: "data",
  },
  {
    key: "trash_auto_purge_days",
    label: "Trash Auto-Purge (days)",
    description: "Days before trash items are permanently deleted",
    type: "number",
    category: "data",
  },
  // §23.12 — Zone Configuration
  {
    key: "zone_set_a",
    label: "Zone Set A",
    description: "Comma-separated zones in Set A (e.g. WEST,CENTRAL)",
    type: "text",
    category: "zone",
  },
  {
    key: "zone_set_b",
    label: "Zone Set B",
    description: "Comma-separated zones in Set B (e.g. EAST,NORTH,SOUTH)",
    type: "text",
    category: "zone",
  },
  {
    key: "zone_enabled",
    label: "Zone System Enabled",
    description: "Enable/disable zone-based form sets",
    type: "toggle",
    category: "zone",
  },
  // §23.12 — Notifications
  {
    key: "notification_admin_emails",
    label: "Admin Alert Emails",
    description: "Comma-separated emails for system alerts",
    type: "text",
    category: "notification",
  },
  {
    key: "notification_email_enabled",
    label: "Email Notifications",
    description: "Send email notifications in addition to in-app",
    type: "toggle",
    category: "notification",
  },
  {
    key: "notification_device_mismatch",
    label: "Device Mismatch Alerts",
    description: "Notify admins when login blocked due to device mismatch",
    type: "toggle",
    category: "notification",
  },
  {
    key: "notification_suspicious_activity",
    label: "Suspicious Activity Alerts",
    description: "Notify admins when suspicious login patterns detected",
    type: "toggle",
    category: "notification",
  },
  // Offer Letter
  {
    key: "offer_letter_signatory_name",
    label: "Signatory Name",
    description: "Name displayed under the signature (default: Shalini Singh)",
    type: "text",
    category: "offer_letter",
  },
  {
    key: "offer_letter_signatory_title",
    label: "Signatory Title",
    description: "Title displayed next to the name (default: HR Manager)",
    type: "text",
    category: "offer_letter",
  },
];

export default function SettingsPage() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [dirtyKeys, setDirtyKeys] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [savingCategory, setSavingCategory] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState("general");

  // Feature flags state
  const [featureFlags, setFeatureFlags] = useState<Record<string, unknown>>({});
  const [flagsLoading, setFlagsLoading] = useState(false);

  // Signature image state
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null);
  const [signatureUploading, setSignatureUploading] = useState(false);
  const [signatureDeleting, setSignatureDeleting] = useState(false);
  const signatureInputRef = useRef<HTMLInputElement>(null);

  // Maintenance mode state
  const [maintenanceActive, setMaintenanceActive] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState("");
  const [maintenanceReturnTime, setMaintenanceReturnTime] = useState("");
  const [maintenanceLoading, setMaintenanceLoading] = useState(false);
  const [maintenanceToggling, setMaintenanceToggling] = useState(false);

  // Fetch maintenance status
  const fetchMaintenanceStatus = useCallback(async () => {
    try {
      const res = await api.get<{
        active: boolean;
        message: string | null;
        estimatedReturnTime: string | null;
      }>("/settings/maintenance");
      setMaintenanceActive(res.data.active);
      setMaintenanceMessage(res.data.message ?? "");
      setMaintenanceReturnTime(res.data.estimatedReturnTime ?? "");
    } catch {
      /* ignore */
    }
  }, []);

  const handleMaintenanceToggle = async () => {
    setMaintenanceToggling(true);
    try {
      if (maintenanceActive) {
        await api.post("/settings/maintenance/disable");
        setMaintenanceActive(false);
        setMaintenanceMessage("");
        setMaintenanceReturnTime("");
        toast.success("Maintenance mode disabled");
      } else {
        await api.post("/settings/maintenance/enable", {
          ...(maintenanceMessage && { message: maintenanceMessage }),
          ...(maintenanceReturnTime && { estimatedReturnTime: maintenanceReturnTime }),
        });
        setMaintenanceActive(true);
        toast.success("Maintenance mode enabled");
      }
    } catch (err) {
      toast.error(extractApiError(err).message);
    } finally {
      setMaintenanceToggling(false);
    }
  };

  const handleMaintenanceUpdate = async () => {
    if (!maintenanceActive) return;
    setMaintenanceLoading(true);
    try {
      // Disable then re-enable with new params
      await api.post("/settings/maintenance/enable", {
        ...(maintenanceMessage && { message: maintenanceMessage }),
        ...(maintenanceReturnTime && { estimatedReturnTime: maintenanceReturnTime }),
      });
      toast.success("Maintenance settings updated");
    } catch (err) {
      toast.error(extractApiError(err).message);
    } finally {
      setMaintenanceLoading(false);
    }
  };

  const handleSignatureUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      toast.error("Only PNG, JPEG, and WebP images are allowed");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Signature image must be under 2MB");
      return;
    }

    setSignatureUploading(true);
    try {
      const result = await uploadSignatureImage(file);
      setSignatureUrl(result.url);
      toast.success("Signature image uploaded");
    } catch (err) {
      toast.error(extractApiError(err).message);
    } finally {
      setSignatureUploading(false);
      // Reset file input
      if (signatureInputRef.current) signatureInputRef.current.value = "";
    }
  };

  const handleSignatureDelete = async () => {
    setSignatureDeleting(true);
    try {
      await deleteSignatureImage();
      setSignatureUrl(null);
      toast.success("Signature image removed");
    } catch (err) {
      toast.error(extractApiError(err).message);
    } finally {
      setSignatureDeleting(false);
    }
  };

  const fetchSettings = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await api.get<{ data: SettingItem[] }>("/settings");
      const map: Record<string, string> = {};
      for (const s of res.data.data) map[s.key] = s.value;
      setSettings(map);
      setDirtyKeys(new Set());
      // Extract signature URL for preview
      setSignatureUrl(map["offer_letter_signature_url"] || null);
    } catch (err) {
      toast.error(extractApiError(err).message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchSettings();
    void fetchMaintenanceStatus();
  }, [fetchSettings, fetchMaintenanceStatus]);

  // Fetch feature flags when that tab is selected
  useEffect(() => {
    if (activeCategory !== "feature-flags") return;
    setFlagsLoading(true);
    void getAllFlags()
      .then(setFeatureFlags)
      .catch(() => toast.error("Failed to load feature flags"))
      .finally(() => setFlagsLoading(false));
  }, [activeCategory]);

  const updateLocal = (key: string, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setDirtyKeys((prev) => new Set(prev).add(key));
  };

  const saveCategory = async (category: string) => {
    const fields = FIELD_DEFS.filter((f) => f.category === category);
    const keysToSave = fields.map((f) => f.key).filter((k) => dirtyKeys.has(k));
    if (!keysToSave.length) {
      toast.info("No changes to save");
      return;
    }

    setSavingCategory(category);
    try {
      for (const key of keysToSave) {
        const parsed = settingValueSchema.safeParse({ key, value: settings[key] });
        if (!parsed.success) {
          toast.error(`Invalid value for ${key}`);
          continue;
        }
        await api.put(`/settings/${key}`, { value: parsed.data.value });
      }
      setDirtyKeys((prev) => {
        const next = new Set(prev);
        for (const k of keysToSave) next.delete(k);
        return next;
      });
      toast.success("Settings saved");
    } catch (err) {
      toast.error(extractApiError(err).message);
    } finally {
      setSavingCategory(null);
    }
  };

  const categoryFields = FIELD_DEFS.filter((f) => f.category === activeCategory);
  const categoryDirty = categoryFields.some((f) => dirtyKeys.has(f.key));

  return (
    <div className="space-y-4">
      <PageHeader title="Platform Settings" />

      {isLoading ? (
        <TableSkeleton rows={6} />
      ) : (
        <div className="flex gap-6">
          {/* Category tabs (sidebar) */}
          <nav className="w-48 shrink-0 space-y-1">
            {CATEGORIES.map((cat) => (
              <Button
                key={cat.key}
                variant={activeCategory === cat.key ? "primary" : "ghost"}
                size="sm"
                fullWidth
                onClick={() => setActiveCategory(cat.key)}
                className="justify-start"
              >
                {cat.label}
              </Button>
            ))}
          </nav>

          {/* Maintenance panel */}
          {activeCategory === "maintenance" && (
            <Card padding="lg" className="flex-1">
              <Card.Header>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle
                      size={18}
                      className={maintenanceActive ? "text-warning-500" : "text-text-muted"}
                    />
                    <h2 className="text-text-primary text-lg font-semibold">Maintenance Mode</h2>
                  </div>
                  {maintenanceActive && (
                    <span className="bg-warning-100 text-warning-700 rounded-full px-3 py-1 text-xs font-medium">
                      Active
                    </span>
                  )}
                </div>
              </Card.Header>

              <Card.Body>
                <div className="space-y-6">
                  {/* Status + Toggle */}
                  <div className="border-border-default bg-bg-muted flex items-center justify-between rounded-lg border p-4">
                    <div>
                      <p className="text-text-primary font-medium">
                        {maintenanceActive ? "Maintenance mode is ON" : "Maintenance mode is OFF"}
                      </p>
                      <p className="text-text-muted text-xs">
                        {maintenanceActive
                          ? "Non-admin users see the maintenance page. Admin can still access the platform."
                          : "All users can access the platform normally."}
                      </p>
                    </div>
                    <Button
                      leftIcon={Power}
                      variant={maintenanceActive ? "danger" : "primary"}
                      loading={maintenanceToggling}
                      onClick={() => void handleMaintenanceToggle()}
                    >
                      {maintenanceActive ? "Disable" : "Enable"}
                    </Button>
                  </div>

                  {/* Custom Message */}
                  <FormField
                    label="Custom Message"
                    htmlFor="maintenance-message"
                    helpText="Shown to users on the maintenance page. Leave empty for default message."
                  >
                    <textarea
                      id="maintenance-message"
                      value={maintenanceMessage}
                      onChange={(e) => setMaintenanceMessage(e.target.value)}
                      placeholder="We're performing scheduled maintenance to improve your experience. We'll be back online shortly."
                      rows={3}
                      className="border-border-default bg-bg-input text-text-primary placeholder:text-text-muted focus:border-border-focus focus:ring-primary-500 w-full rounded-md border px-3 py-2 text-sm focus:ring-1 focus:outline-hidden"
                    />
                  </FormField>

                  {/* Estimated Return Time */}
                  <FormField
                    label="Estimated Return Time"
                    htmlFor="maintenance-return"
                    helpText="Set a countdown timer on the maintenance page. Leave empty for no timer."
                  >
                    <div className="flex items-center gap-2">
                      <CalendarDatePicker
                        value={maintenanceReturnTime ? maintenanceReturnTime.slice(0, 10) : ""}
                        onChange={(dateVal) => {
                          const timePart = maintenanceReturnTime
                            ? maintenanceReturnTime.slice(11, 16)
                            : "00:00";
                          if (dateVal) {
                            setMaintenanceReturnTime(
                              new Date(`${dateVal}T${timePart}`).toISOString(),
                            );
                          } else {
                            setMaintenanceReturnTime("");
                          }
                        }}
                        clearable
                        size="sm"
                      />
                      <TimePicker
                        value={maintenanceReturnTime ? maintenanceReturnTime.slice(11, 16) : ""}
                        onChange={(timeVal) => {
                          const datePart = maintenanceReturnTime
                            ? maintenanceReturnTime.slice(0, 10)
                            : new Date().toISOString().slice(0, 10);
                          if (timeVal) {
                            setMaintenanceReturnTime(
                              new Date(`${datePart}T${timeVal}`).toISOString(),
                            );
                          }
                        }}
                        size="sm"
                      />
                    </div>
                  </FormField>

                  {/* Update button (when active and fields changed) */}
                  {maintenanceActive && (
                    <Button
                      leftIcon={Save}
                      onClick={() => void handleMaintenanceUpdate()}
                      loading={maintenanceLoading}
                    >
                      Update Maintenance Settings
                    </Button>
                  )}

                  {/* Info box about Firebase */}
                  <div className="border-border-default bg-bg-surface rounded-lg border p-4">
                    <p className="text-text-secondary text-xs font-medium">
                      About maintenance sources
                    </p>
                    <ul className="text-text-muted mt-2 space-y-1 text-xs">
                      <li>
                        <strong>This panel</strong> — Blocks non-admin users. Admin can still
                        access.
                      </li>
                      <li>
                        <strong>Firebase Remote Config</strong> — Blocks ALL users including admin.
                        Set <code className="bg-bg-muted rounded-sm px-1">maintenanceMode</code> to{" "}
                        <code className="bg-bg-muted rounded-sm px-1">true</code> in Firebase
                        Console for full platform lockdown.
                      </li>
                    </ul>
                  </div>
                </div>
              </Card.Body>
            </Card>
          )}

          {/* Offer Letter panel — signature image + signatory fields */}
          {activeCategory === "offer_letter" && (
            <Card padding="lg" className="flex-1">
              <Card.Header>
                <div className="flex items-center gap-2">
                  <FileSignature size={18} className="text-primary-500" />
                  <h2 className="text-text-primary text-lg font-semibold">Offer Letter Settings</h2>
                </div>
                <p className="text-text-muted mt-1 text-sm">
                  Configure the signatory block that appears at the bottom of generated offer letter
                  PDFs.
                </p>
              </Card.Header>
              <Card.Body>
                <div className="space-y-6">
                  {/* Signature Image Upload */}
                  <div>
                    <p className="text-text-primary text-sm font-medium">Signature Image</p>
                    <p className="text-text-muted mt-0.5 text-xs">
                      Upload a signature image (PNG, JPEG, or WebP, max 2MB). This will be embedded
                      in generated PDFs.
                    </p>
                    <div className="mt-3">
                      {signatureUrl ? (
                        <div className="border-border-default rounded-lg border p-4">
                          <div className="flex items-center gap-4">
                            <div className="bg-bg-muted rounded-md border p-2">
                              <Image
                                src={signatureUrl}
                                alt="Signature"
                                width={200}
                                height={80}
                                className="max-h-20 w-auto object-contain"
                                unoptimized
                              />
                            </div>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="ghost"
                                leftIcon={Upload}
                                loading={signatureUploading}
                                onClick={() => signatureInputRef.current?.click()}
                              >
                                Replace
                              </Button>
                              <Button
                                size="sm"
                                variant="danger"
                                leftIcon={Trash2}
                                loading={signatureDeleting}
                                onClick={() => void handleSignatureDelete()}
                              >
                                Remove
                              </Button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => signatureInputRef.current?.click()}
                          disabled={signatureUploading}
                          className="border-border-default hover:border-primary-400 hover:bg-bg-muted flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed p-8 transition-colors"
                        >
                          {signatureUploading ? (
                            <span className="text-text-muted text-sm">Uploading...</span>
                          ) : (
                            <>
                              <Upload size={18} className="text-text-muted" />
                              <span className="text-text-muted text-sm">
                                Click to upload signature image
                              </span>
                            </>
                          )}
                        </button>
                      )}
                      <input
                        ref={signatureInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="hidden"
                        onChange={(e) => void handleSignatureUpload(e)}
                      />
                    </div>
                  </div>

                  {/* Signatory name and title fields — reuse the generic settings form */}
                  {categoryFields.map((field) => (
                    <div key={field.key} className="flex items-start justify-between gap-8">
                      <div className="flex-1">
                        <p className="text-text-primary text-sm font-medium">{field.label}</p>
                        <p className="text-text-muted mt-0.5 text-xs">{field.description}</p>
                      </div>
                      <div className="w-56 shrink-0">
                        <Input
                          type="text"
                          value={settings[field.key] ?? ""}
                          onChange={(e) => updateLocal(field.key, e.target.value)}
                        />
                      </div>
                    </div>
                  ))}

                  <div className="flex justify-end">
                    <Button
                      leftIcon={Save}
                      onClick={() => void saveCategory("offer_letter")}
                      disabled={!categoryDirty}
                      loading={savingCategory === "offer_letter"}
                    >
                      Save
                    </Button>
                  </div>
                </div>
              </Card.Body>
            </Card>
          )}

          {/* Feature Flags panel */}
          {activeCategory === "feature-flags" && (
            <Card padding="lg" className="flex-1">
              <Card.Header>
                <div className="flex items-center gap-2">
                  <Flag size={18} className="text-primary-500" />
                  <h2 className="text-text-primary text-lg font-semibold">Feature Flags</h2>
                </div>
                <p className="text-text-muted mt-1 text-sm">
                  Read-only view of all feature flags. Flags are managed via Firebase Remote Config
                  or platform settings.
                </p>
              </Card.Header>
              <Card.Body>
                {flagsLoading ? (
                  <TableSkeleton rows={5} />
                ) : Object.keys(featureFlags).length === 0 ? (
                  <div className="text-text-muted flex items-center justify-center py-12 text-sm">
                    <Flag size={16} className="mr-2" /> No feature flags configured
                  </div>
                ) : (
                  <div className="space-y-3">
                    {Object.entries(featureFlags).map(([key, value]) => (
                      <div
                        key={key}
                        className="border-border-default flex items-center justify-between rounded-lg border px-4 py-3"
                      >
                        <div>
                          <p className="text-text-primary font-mono text-sm font-medium">{key}</p>
                        </div>
                        <div>
                          {typeof value === "boolean" ? (
                            <span
                              className={`rounded-full px-3 py-1 text-xs font-medium ${value ? "bg-success-100 text-success-700" : "bg-error-100 text-error-700"}`}
                            >
                              {value ? "Enabled" : "Disabled"}
                            </span>
                          ) : (
                            <code className="bg-surface-secondary rounded px-2 py-1 text-xs">
                              {JSON.stringify(value)}
                            </code>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card.Body>
            </Card>
          )}

          {/* Settings form */}
          {activeCategory !== "maintenance" &&
            activeCategory !== "feature-flags" &&
            activeCategory !== "offer_letter" && (
              <Card padding="lg" className="flex-1">
                <Card.Header>
                  <div className="flex items-center justify-between">
                    <h2 className="text-text-primary text-lg font-semibold">
                      {CATEGORIES.find((c) => c.key === activeCategory)?.label}
                    </h2>
                    <Button
                      leftIcon={Save}
                      onClick={() => void saveCategory(activeCategory)}
                      disabled={!categoryDirty}
                      loading={savingCategory === activeCategory}
                    >
                      Save
                    </Button>
                  </div>
                </Card.Header>

                <Card.Body>
                  <div className="space-y-5">
                    {categoryFields.map((field) => (
                      <div key={field.key} className="flex items-start justify-between gap-8">
                        <div className="flex-1">
                          <p className="text-text-primary text-sm font-medium">{field.label}</p>
                          <p className="text-text-muted mt-0.5 text-xs">{field.description}</p>
                        </div>
                        <div className="w-56 shrink-0">
                          {field.type === "toggle" ? (
                            <Switch
                              checked={settings[field.key] === "true"}
                              onChange={(checked) =>
                                updateLocal(field.key, checked ? "true" : "false")
                              }
                            />
                          ) : field.type === "select" ? (
                            <Select
                              value={settings[field.key] ?? ""}
                              onChange={(e) => updateLocal(field.key, e.target.value)}
                              options={
                                field.options?.map((o) => ({ value: o.value, label: o.label })) ??
                                []
                              }
                            />
                          ) : field.type === "time" ? (
                            <TimePicker
                              value={settings[field.key] ?? ""}
                              onChange={(val) => updateLocal(field.key, val)}
                            />
                          ) : (
                            <Input
                              type={field.type === "number" ? "number" : "text"}
                              value={settings[field.key] ?? ""}
                              onChange={(e) => updateLocal(field.key, e.target.value)}
                            />
                          )}
                        </div>
                      </div>
                    ))}

                    {categoryFields.length === 0 && (
                      <div className="text-text-muted flex items-center justify-center py-12 text-sm">
                        <Settings size={16} className="mr-2" /> No settings in this category
                      </div>
                    )}
                  </div>
                </Card.Body>
              </Card>
            )}
        </div>
      )}
    </div>
  );
}
