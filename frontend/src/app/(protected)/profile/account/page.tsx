"use client";

import { useState } from "react";
import { KeyRound, Mail, Phone, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { useAuth } from "@/contexts/auth";
import { useRouter } from "next/navigation";
import { ROLES } from "@/constants/roles";
import {
  changePassword,
  requestEmailChange,
  verifyEmailChange,
  updateMobile,
} from "@/services/account.service";
import { PageHeader, Card, FormField, Input, PhoneInput, Button } from "@/components/ui";
import { PasswordStrength } from "@/components/password-strength";

// ──────────────────────────────────────────────
//  Account Settings Page
//  Admin self-service: password, email, mobile
// ──────────────────────────────────────────────

export default function AccountSettingsPage() {
  const { user, refresh } = useAuth();
  const router = useRouter();

  // Admin-only page — redirect non-admin users
  if (user && user.role !== ROLES.ADMIN) {
    router.replace("/profile");
    return null;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/profile"
          className="text-text-muted hover:text-text-primary rounded-lg p-1 transition-colors"
        >
          <ArrowLeft size={20} />
        </Link>
        <PageHeader title="Account Settings" />
      </div>

      <ChangePasswordSection />
      <ChangeEmailSection currentEmail={user?.email ?? ""} onSuccess={() => void refresh?.()} />
      <ChangeMobileSection
        currentMobile={user?.mobileNumber ?? ""}
        onSuccess={() => void refresh?.()}
      />
    </div>
  );
}

// ──────────────────────────────────────────────
//  Password Change Section
// ──────────────────────────────────────────────

function ChangePasswordSection() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const passwordsMatch = newPassword === confirmPassword;
  const canSubmit =
    currentPassword.length > 0 &&
    newPassword.length >= 8 &&
    confirmPassword.length > 0 &&
    passwordsMatch;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setError("");
    setIsLoading(true);
    try {
      await changePassword(currentPassword, newPassword);
      toast.success("Password changed successfully. Please login again.");
      // Redirect to login since all sessions are terminated
      setTimeout(() => router.push("/login"), 1500);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string; details?: string[] } } })?.response?.data
          ?.error ?? "Failed to change password";
      const details = (err as { response?: { data?: { details?: string[] } } })?.response?.data
        ?.details;
      setError(details ? details.join(". ") : msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <Card.Header>
        <div className="flex items-center gap-2">
          <KeyRound size={18} className="text-primary-500" />
          <h3 className="text-text-primary font-semibold">Change Password</h3>
        </div>
        <p className="text-text-muted mt-1 text-sm">
          You must verify your current password. All sessions will be terminated after changing.
        </p>
      </Card.Header>
      <Card.Body className="space-y-4">
        <FormField label="Current Password" htmlFor="current-password" required>
          <Input
            id="current-password"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="Enter current password"
            autoComplete="current-password"
          />
        </FormField>

        <FormField label="New Password" htmlFor="new-password" required>
          <Input
            id="new-password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Enter new password"
            autoComplete="new-password"
          />
          {newPassword.length > 0 && <PasswordStrength password={newPassword} />}
        </FormField>

        <FormField label="Confirm New Password" htmlFor="confirm-password" required>
          <Input
            id="confirm-password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Re-enter new password"
            autoComplete="new-password"
          />
          {confirmPassword.length > 0 && !passwordsMatch && (
            <p className="text-error-500 mt-1 text-xs">Passwords do not match</p>
          )}
        </FormField>

        {error && <p className="text-error-500 text-sm">{error}</p>}

        <Button
          leftIcon={KeyRound}
          loading={isLoading}
          disabled={!canSubmit}
          onClick={() => void handleSubmit()}
        >
          Change Password
        </Button>
      </Card.Body>
    </Card>
  );
}

// ──────────────────────────────────────────────
//  Email Change Section (2-step OTP flow)
// ──────────────────────────────────────────────

function ChangeEmailSection({
  currentEmail,
  onSuccess,
}: {
  currentEmail: string;
  onSuccess: () => void;
}) {
  const [step, setStep] = useState<"request" | "verify">("request");
  const [newEmail, setNewEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const canRequest = newEmail.length > 0 && password.length > 0 && newEmail !== currentEmail;
  const canVerify = otp.length === 6;

  const handleRequestOtp = async () => {
    if (!canRequest) return;
    setError("");
    setIsLoading(true);
    try {
      const res = await requestEmailChange(newEmail, password);
      toast.success(res.message);
      setStep("verify");
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        "Failed to send verification code";
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!canVerify) return;
    setError("");
    setIsLoading(true);
    try {
      const res = await verifyEmailChange(otp);
      toast.success(res.message);
      onSuccess();
      // Reset form
      setStep("request");
      setNewEmail("");
      setPassword("");
      setOtp("");
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        "Invalid or expired verification code";
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <Card.Header>
        <div className="flex items-center gap-2">
          <Mail size={18} className="text-primary-500" />
          <h3 className="text-text-primary font-semibold">Change Email Address</h3>
        </div>
        <p className="text-text-muted mt-1 text-sm">
          Current: <span className="text-text-primary font-medium">{currentEmail}</span>
          {" — "}A 6-digit verification code will be sent to your new email.
        </p>
      </Card.Header>
      <Card.Body className="space-y-4">
        {step === "request" ? (
          <>
            <FormField label="New Email Address" htmlFor="new-email" required>
              <Input
                id="new-email"
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="Enter new email address"
              />
            </FormField>

            <FormField label="Confirm Password" htmlFor="email-password" required>
              <Input
                id="email-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password to confirm"
                autoComplete="current-password"
              />
            </FormField>

            {error && <p className="text-error-500 text-sm">{error}</p>}

            <Button
              leftIcon={Mail}
              loading={isLoading}
              disabled={!canRequest}
              onClick={() => void handleRequestOtp()}
            >
              Send Verification Code
            </Button>
          </>
        ) : (
          <>
            <div className="bg-info-50 border-info-200 rounded-lg border p-3">
              <p className="text-info-700 text-sm">
                A 6-digit verification code has been sent to <strong>{newEmail}</strong>. Check your
                inbox (and spam folder).
              </p>
            </div>

            <FormField label="Verification Code" htmlFor="email-otp" required>
              <Input
                id="email-otp"
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="Enter 6-digit code"
                className="font-mono text-lg tracking-widest"
              />
            </FormField>

            {error && <p className="text-error-500 text-sm">{error}</p>}

            <div className="flex gap-3">
              <Button
                leftIcon={Mail}
                loading={isLoading}
                disabled={!canVerify}
                onClick={() => void handleVerifyOtp()}
              >
                Verify & Change Email
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setStep("request");
                  setOtp("");
                  setError("");
                }}
              >
                Cancel
              </Button>
            </div>
          </>
        )}
      </Card.Body>
    </Card>
  );
}

// ──────────────────────────────────────────────
//  Mobile Number Change Section
// ──────────────────────────────────────────────

function ChangeMobileSection({
  currentMobile,
  onSuccess,
}: {
  currentMobile: string;
  onSuccess: () => void;
}) {
  const [mobileNumber, setMobileNumber] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const canSubmit = mobileNumber.length > 0 && password.length > 0;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setError("");
    setIsLoading(true);
    try {
      await updateMobile(mobileNumber, password);
      toast.success("Mobile number updated successfully");
      onSuccess();
      setMobileNumber("");
      setPassword("");
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        "Failed to update mobile number";
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <Card.Header>
        <div className="flex items-center gap-2">
          <Phone size={18} className="text-primary-500" />
          <h3 className="text-text-primary font-semibold">Change Mobile Number</h3>
        </div>
        <p className="text-text-muted mt-1 text-sm">
          Current:{" "}
          <span className="text-text-primary font-medium">{currentMobile || "Not set"}</span>
          {" — "}Password verification required.
        </p>
      </Card.Header>
      <Card.Body className="space-y-4">
        <FormField label="New Mobile Number" htmlFor="new-mobile" required>
          <PhoneInput
            id="new-mobile"
            value={mobileNumber}
            onChange={setMobileNumber}
            placeholder="Enter new mobile number"
          />
        </FormField>

        <FormField label="Confirm Password" htmlFor="mobile-password" required>
          <Input
            id="mobile-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password to confirm"
            autoComplete="current-password"
          />
        </FormField>

        {error && <p className="text-error-500 text-sm">{error}</p>}

        <Button
          leftIcon={Phone}
          loading={isLoading}
          disabled={!canSubmit}
          onClick={() => void handleSubmit()}
        >
          Update Mobile Number
        </Button>
      </Card.Body>
    </Card>
  );
}
