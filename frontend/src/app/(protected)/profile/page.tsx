"use client";

import { useState, useEffect, useRef } from "react";
import {
  Camera,
  Save,
  Trash2,
  Shield,
  Calendar,
  Clock,
  FileCheck,
  Settings,
  Fingerprint,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { useAuth } from "@/contexts/auth";
import { api } from "@/lib/api";
import { ROLES } from "@/constants/roles";
import {
  uploadProfilePhoto as uploadPhoto,
  deleteProfilePhoto as removePhoto,
} from "@/services/upload.service";
import {
  PageHeader,
  Card,
  Avatar,
  FormField,
  Input,
  Textarea,
  Button,
  Badge,
  ConfirmDialog,
} from "@/components/ui";
import { ProfilePhotoCrop } from "@/components/profile-photo-crop";
import { cn } from "@/lib/utils";

export default function ProfilePage() {
  const { user, refresh } = useAuth();
  const [mobileNumber, setMobileNumber] = useState("");
  const [address, setAddress] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [showCrop, setShowCrop] = useState(false);
  const [cropImageUrl, setCropImageUrl] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [kycStatus, setKycStatus] = useState<{
    status: string;
    verified: number;
    required: number;
  } | null>(null);
  const [attendanceSummary, setAttendanceSummary] = useState<{
    present: number;
    late: number;
    absent: number;
  } | null>(null);
  const [leaveBalances, setLeaveBalances] = useState<
    Array<{ code: string; name: string; remaining: number; totalAllotted: number }>
  >([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  // Sync from user context
  useEffect(() => {
    if (user) {
      setMobileNumber(user.mobileNumber ?? "");
      setAddress(user.address ?? "");
    }
  }, [user]);

  // Fetch KYC, attendance, leave for non-admin
  useEffect(() => {
    if (!user || user.role === ROLES.ADMIN) return;

    // KYC status
    api
      .get(`/documents/kyc-status?userId=${user.id}`)
      .then((r) => setKycStatus(r.data as { status: string; verified: number; required: number }))
      .catch(() => {});

    // Attendance summary (current month)
    api
      .get<{ records: Array<{ status: string; isLate: boolean }> }>("/attendance/my")
      .then((r) => {
        const records = r.data.records ?? [];
        setAttendanceSummary({
          present: records.filter((a) => a.status.startsWith("PRESENT")).length,
          late: records.filter((a) => a.isLate).length,
          absent: records.filter((a) => a.status === "ABSENT").length,
        });
      })
      .catch(() => {});

    // Leave balances
    api
      .get<{
        balances: Array<{
          leaveType: { code: string; name: string };
          remaining: number;
          totalAllotted: number;
        }>;
      }>("/leaves/balances")
      .then((r) => {
        setLeaveBalances(
          (r.data.balances ?? []).map((b) => ({
            code: b.leaveType.code,
            name: b.leaveType.name,
            remaining: b.remaining,
            totalAllotted: b.totalAllotted,
          })),
        );
      })
      .catch(() => {});
  }, [user]);

  const isDirty = mobileNumber !== (user?.mobileNumber ?? "") || address !== (user?.address ?? "");

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await api.patch("/auth/me/profile", { mobileNumber, address });
      if (refresh) await refresh();
      toast.success("Profile updated");
    } catch {
      toast.error("Failed to update profile");
    } finally {
      setIsSaving(false);
    }
  };

  // §30.2.1 — Drag-and-drop photo upload
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please drop an image file");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5 MB");
      return;
    }
    const url = URL.createObjectURL(file);
    setCropImageUrl(url);
    setShowCrop(true);
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5 MB");
      return;
    }
    const url = URL.createObjectURL(file);
    setCropImageUrl(url);
    setShowCrop(true);
    // Reset input so same file can be re-selected
    e.target.value = "";
  };

  const handleCropComplete = async (blob: Blob) => {
    setShowCrop(false);
    try {
      const file = new File([blob], "profile.jpg", { type: "image/jpeg" });
      await uploadPhoto(file);
      if (refresh) await refresh();
      toast.success("Profile photo updated");
    } catch {
      toast.error("Failed to upload photo");
    }
  };

  const handleRemovePhoto = async () => {
    try {
      await removePhoto();
      if (refresh) await refresh();
      toast.success("Profile photo removed");
    } catch {
      toast.error("Failed to remove photo");
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title="My Profile" />

      {/* Avatar Section — §30.2.1 drag-and-drop + click */}
      <Card>
        <div className="flex items-center gap-6">
          <div
            className={cn(
              "relative rounded-full",
              isDragOver && "ring-primary-500 ring-4 ring-offset-2",
            )}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
          >
            <Avatar
              name={user?.name ?? "User"}
              src={user?.profilePhotoUrl ?? undefined}
              size="xl"
              className="h-24 w-24 text-2xl"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="bg-primary-500 hover:bg-primary-600 absolute right-0 bottom-0 flex h-8 w-8 items-center justify-center rounded-full text-white shadow-md"
            >
              <Camera size={14} />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handlePhotoSelect}
            />
          </div>
          <div>
            <h2 className="text-text-primary text-xl font-bold">{user?.name}</h2>
            <p className="text-text-secondary text-sm">{user?.role?.replace("_", " ")}</p>
            <p className="text-text-muted text-sm">{user?.email}</p>
            {user?.profilePhotoUrl && (
              <button
                onClick={() => setConfirmRemove(true)}
                className="text-error-500 mt-1 flex items-center gap-1 text-xs hover:underline"
              >
                <Trash2 size={12} /> Remove Photo
              </button>
            )}
          </div>
        </div>
      </Card>

      {/* Personal Information */}
      <Card>
        <Card.Header>
          <h3 className="text-text-secondary text-sm font-medium">Personal Information</h3>
        </Card.Header>
        <Card.Body className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-text-muted mb-1 block text-xs">Employee ID</label>
              <p className="text-text-primary font-mono text-sm">{user?.employeeId ?? "\u2014"}</p>
            </div>
            <div>
              <label className="text-text-muted mb-1 block text-xs">Email</label>
              <p className="text-text-primary text-sm">{user?.email}</p>
            </div>
            <div>
              <label className="text-text-muted mb-1 block text-xs">Role</label>
              <Badge variant="primary">{user?.role?.replace("_", " ")}</Badge>
            </div>
            <div>
              <label className="text-text-muted mb-1 block text-xs">Account Status</label>
              <Badge variant={user?.status === "ACTIVE" ? "success" : "warning"} dot>
                {user?.status ?? "Active"}
              </Badge>
            </div>
            <div>
              <label className="text-text-muted mb-1 block text-xs">Member Since</label>
              <p className="text-text-primary text-sm">
                {user?.createdAt
                  ? new Date(user.createdAt).toLocaleDateString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })
                  : "\u2014"}
              </p>
            </div>
            <div>
              <label className="text-text-muted mb-1 block text-xs">Device Status</label>
              <Badge variant={user?.deviceId ? "success" : "outline"} size="sm">
                {user?.deviceId ? "Bound" : "Unbound"}
              </Badge>
            </div>
            <div>
              <label className="text-text-muted mb-1 block text-xs">Last Login</label>
              <p className="text-text-primary text-sm">
                {user?.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString("en-IN") : "\u2014"}
              </p>
            </div>
            {user?.assignedManagers && user.assignedManagers.length > 0 && (
              <div>
                <label className="text-text-muted mb-1 block text-xs">Reporting Manager(s)</label>
                <div className="flex flex-wrap gap-1">
                  {user.assignedManagers.map((m) => (
                    <Badge key={m.manager.id} variant="outline" size="sm">
                      {m.manager.firstName} {m.manager.lastName}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>

          <FormField label="Mobile Number" htmlFor="mobile">
            <Input
              id="mobile"
              type="tel"
              value={mobileNumber}
              onChange={(e) => setMobileNumber(e.target.value)}
              placeholder="Enter mobile number"
            />
          </FormField>

          <FormField label="Address" htmlFor="address">
            <Textarea
              id="address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Enter address"
              rows={3}
            />
          </FormField>

          <Button
            leftIcon={Save}
            loading={isSaving}
            disabled={!isDirty}
            onClick={() => void handleSave()}
          >
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
        </Card.Body>
      </Card>

      {/* Account Settings (admin only) */}
      {user?.role === ROLES.ADMIN && (
        <Card>
          <Card.Body className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Settings size={20} className="text-primary-500" />
              <div>
                <p className="text-text-primary font-medium">Account Settings</p>
                <p className="text-text-muted text-sm">
                  Change your password, email address, or mobile number
                </p>
              </div>
            </div>
            <Link
              href="/profile/account"
              className="bg-primary-50 text-primary-600 hover:bg-primary-100 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
            >
              Manage
            </Link>
          </Card.Body>
        </Card>
      )}

      {/* Passkeys */}
      <Card>
        <Card.Body className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Fingerprint size={20} className="text-primary-500" />
            <div>
              <p className="text-text-primary font-medium">Passkeys</p>
              <p className="text-text-muted text-sm">
                Manage biometric and security key authentication
              </p>
            </div>
          </div>
          <Link
            href="/profile/passkeys"
            className="bg-primary-50 text-primary-600 hover:bg-primary-100 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
          >
            Manage
          </Link>
        </Card.Body>
      </Card>

      {/* Info Sections (non-admin only) */}
      {user?.role !== ROLES.ADMIN && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* KYC Status */}
          <Card>
            <Card.Body className="flex items-start gap-3">
              <FileCheck size={20} className="text-primary-500 mt-0.5" />
              <div>
                <p className="text-text-muted text-xs">KYC Status</p>
                <p className="text-text-primary font-medium">{kycStatus?.status ?? "Loading..."}</p>
                {kycStatus && (
                  <p className="text-text-muted text-xs">
                    {kycStatus.verified}/{kycStatus.required} documents verified
                  </p>
                )}
              </div>
            </Card.Body>
          </Card>

          {/* Attendance Summary */}
          <Card>
            <Card.Body className="flex items-start gap-3">
              <Calendar size={20} className="text-success-500 mt-0.5" />
              <div>
                <p className="text-text-muted text-xs">This Month Attendance</p>
                {attendanceSummary ? (
                  <div className="flex gap-3 text-sm">
                    <span className="text-success-500">{attendanceSummary.present} present</span>
                    <span className="text-warning-500">{attendanceSummary.late} late</span>
                    <span className="text-error-500">{attendanceSummary.absent} absent</span>
                  </div>
                ) : (
                  <p className="text-text-muted text-sm">Loading...</p>
                )}
              </div>
            </Card.Body>
          </Card>

          {/* Leave Balance */}
          <Card>
            <Card.Body className="flex items-start gap-3">
              <Clock size={20} className="text-info-500 mt-0.5" />
              <div className="flex-1">
                <p className="text-text-muted text-xs">Leave Balance</p>
                {leaveBalances.length > 0 ? (
                  <div className="mt-1 flex flex-wrap gap-2">
                    {leaveBalances.map((b) => (
                      <span key={b.code} className="text-xs">
                        <span className="text-text-primary font-medium">{b.code}:</span>{" "}
                        <span
                          className={b.remaining <= 2 ? "text-error-500" : "text-text-secondary"}
                        >
                          {b.remaining}/{b.totalAllotted}
                        </span>
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-text-muted text-sm">No balance data</p>
                )}
              </div>
            </Card.Body>
          </Card>

          {/* Security Info */}
          <Card>
            <Card.Body className="flex items-start gap-3">
              <Shield size={20} className="text-warning-500 mt-0.5" />
              <div>
                <p className="text-text-muted text-xs">Security</p>
                <p className="text-text-primary text-sm">Status: Active</p>
                <p className="text-text-muted text-xs">Role: {user?.role?.replace("_", " ")}</p>
              </div>
            </Card.Body>
          </Card>
        </div>
      )}

      {/* Photo Crop Modal */}
      {cropImageUrl && (
        <ProfilePhotoCrop
          open={showCrop}
          onClose={() => setShowCrop(false)}
          imageUrl={cropImageUrl ?? ""}
          onCropComplete={(blob) => void handleCropComplete(blob)}
          onChangeImage={() => {
            setShowCrop(false);
            // Small delay to let modal close before opening file picker
            setTimeout(() => fileInputRef.current?.click(), 200);
          }}
        />
      )}

      {/* Photo Remove Confirmation */}
      <ConfirmDialog
        open={confirmRemove}
        onClose={() => setConfirmRemove(false)}
        onConfirm={() => void handleRemovePhoto().then(() => setConfirmRemove(false))}
        title="Remove Profile Photo?"
        description="Your profile photo will be permanently removed. The default avatar will be shown instead. This action cannot be undone."
        confirmLabel="Remove Photo"
        variant="danger"
      />
    </div>
  );
}
