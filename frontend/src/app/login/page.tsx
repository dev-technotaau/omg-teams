"use client";

import { useState, useCallback, useEffect } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import axios from "axios";
import { Sun, Moon, Eye, EyeOff, AlertTriangle } from "lucide-react";
import { useTheme } from "next-themes";
import { extractApiError } from "@/lib/api";
import { getDeviceId } from "@/lib/device-id";
import { Turnstile } from "@/components/common/turnstile";
import { Modal, Button } from "@/components/ui";
import { cn } from "@/lib/utils";
import { ALL_ROLE_OPTIONS } from "@/constants/roles";
import { ROUTES } from "@/constants/routes";
import {
  isWebAuthnSupported,
  getLoginOptions,
  loginWithPasskey,
} from "@/services/webauthn.service";
import { startAuthentication } from "@simplewebauthn/browser";

// ──────────────────────────────────────────────
//  Login Page — 3-Tab Interface
//  Spec Section 4
// ──────────────────────────────────────────────

// "TEAM" is the client-side bucket that the backend resolves to either
// RECRUITER or REPORTING_MANAGER from the user record. ADMIN stays separate.
type RoleTab = "TEAM" | "ADMIN";
type ResolvedRole = "RECRUITER" | "REPORTING_MANAGER" | "ADMIN";

const TABS: { key: RoleTab; label: string }[] = [
  { key: "TEAM", label: "Team" },
  { key: "ADMIN", label: ALL_ROLE_OPTIONS.find((r) => r.value === "ADMIN")?.label ?? "Admin" },
];

const ROLE_DASHBOARDS: Record<ResolvedRole, string> = {
  ADMIN: ROUTES.ADMIN_DASHBOARD,
  RECRUITER: ROUTES.DASHBOARD,
  REPORTING_MANAGER: ROUTES.DASHBOARD,
};

// Generic shape — per-field format validation is tab-aware and lives on
// the `register("identifier", { validate })` callback below, because the
// expected format flips between Email (ADMIN) and Employee ID (others).
const loginSchema = z.object({
  identifier: z.string().min(1, "This field is required"),
  password: z.string().min(1, "Password is required"),
});

type LoginForm = z.infer<typeof loginSchema>;

// RFC-lite email check — good enough for client UX, the backend is
// authoritative for the real validation.
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Employee IDs come in two shapes:
//   • Legacy: OMG-NNNN (4+ digits, kept for users created before the
//     enumeration-mitigation switch — these IDs are still valid forever).
//   • Current: OMG-XXXXXX (6 RFC 4648 base32 chars, A-Z + 2-7) — generated
//     by user.service.ts#generateEmployeeId so attackers can't enumerate
//     the integer space.
// Accept either format on the login form.
const EMPLOYEE_ID_REGEX = /^OMG-(?:\d{4,}|[A-Z2-7]{6})$/i;

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect");

  const [activeTab, setActiveTab] = useState<RoleTab>("TEAM");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  // §23.16 — Backup code for device lock bypass
  const [showBackupCode, setShowBackupCode] = useState(false);
  const [backupCode, setBackupCode] = useState("");
  // Passkey login
  const [passkeySupported, setPasskeySupported] = useState(false);
  const [passkeyLoading, setPasskeyLoading] = useState(false);
  // Admin session-conflict modal — when an admin tries to log in while
  // already having an active session on another device, the backend returns
  // 409 SESSION_EXISTS. We stash the original attempt details here so the
  // "Continue" button can re-submit the same flow with confirmReplaceSession.
  type PendingConflict =
    | { kind: "password"; data: LoginForm }
    | { kind: "passkey" }
    | null;
  const [pendingConflict, setPendingConflict] = useState<PendingConflict>(null);

  const {
    register,
    handleSubmit,
    formState: { errors: formErrors },
    reset,
    trigger,
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    // Only show validation errors after the user clicks Login.
    mode: "onSubmit",
    reValidateMode: "onChange",
  });

  // Tab-aware identifier validator. Returns true on valid, error string otherwise.
  const validateIdentifier = useCallback(
    (value: string) => {
      if (!value) return "This field is required";
      if (activeTab === "ADMIN") {
        return EMAIL_REGEX.test(value) || "Enter a valid email address";
      }
      return EMPLOYEE_ID_REGEX.test(value) || "Employee ID must look like OMG-XXXXXX";
    },
    [activeTab],
  );

  // Check passkey support on mount
  useEffect(() => {
    setPasskeySupported(isWebAuthnSupported());
  }, []);

  const onPasskeyLogin = useCallback(
    async (confirmReplaceSession = false) => {
      setPasskeyLoading(true);
      setError("");
      try {
        const deviceId = getDeviceId();
        const { options, challengeId } = await getLoginOptions();

        const attResp = await startAuthentication({ optionsJSON: options });
        const result = await loginWithPasskey(
          attResp as unknown as Record<string, unknown>,
          challengeId,
          deviceId,
          confirmReplaceSession,
        );
        const role = result.user.role as ResolvedRole;
        const destination = redirectTo ?? ROLE_DASHBOARDS[role] ?? "/dashboard";
        router.push(destination);
      } catch (err: unknown) {
        // User cancelled the browser prompt
        if (err instanceof Error && err.name === "NotAllowedError") {
          setError("Passkey authentication was cancelled");
          return;
        }
        const apiErr = extractApiError(err);
        // Admin already has an active session on another device — prompt
        // for explicit confirmation before nuking it.
        if (apiErr.code === "SESSION_EXISTS") {
          setPendingConflict({ kind: "passkey" });
          return;
        }
        setError(apiErr.message);
      } finally {
        setPasskeyLoading(false);
      }
    },
    [redirectTo, router],
  );

  const onTabChange = useCallback(
    (tab: RoleTab) => {
      setActiveTab(tab);
      setError("");
      reset();
    },
    [reset],
  );

  // When the user switches tabs, re-validate only if the identifier field
  // already has a validation error (i.e. the user interacted with it).
  // Without this guard the effect fires on mount and shows "required" on a
  // pristine form.
  useEffect(() => {
    if (formErrors.identifier) {
      void trigger("identifier");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-run on tab change, not on formErrors change
  }, [activeTab, trigger]);

  // Submit the password login. Extracted into its own function (rather than
  // living entirely inside onSubmit) so the session-conflict modal's
  // "Continue" button can re-fire the same request with confirmReplaceSession.
  const submitPasswordLogin = useCallback(
    async (data: LoginForm, confirmReplaceSession: boolean) => {
      setIsLoading(true);
      setError("");
      try {
        const deviceId = getDeviceId();
        const response = await axios.post<{ user: { role: string } }>("/api/auth/login", {
          identifier: data.identifier,
          password: data.password,
          role: activeTab,
          deviceId,
          turnstileToken,
          ...(backupCode && { backupCode }),
          ...(confirmReplaceSession && { confirmReplaceSession: true }),
        });
        const role = response.data.user.role as ResolvedRole;
        const destination = redirectTo ?? ROLE_DASHBOARDS[role] ?? "/dashboard";
        router.push(destination);
      } catch (err) {
        const apiErr = extractApiError(err);
        // Admin already logged in elsewhere — show confirmation modal so they
        // can decide whether to log out the other device.
        if (apiErr.code === "SESSION_EXISTS") {
          setPendingConflict({ kind: "password", data });
          return;
        }
        setError(apiErr.message);
        // §23.16 — Show backup code field on device mismatch error
        if (
          apiErr.message.toLowerCase().includes("device") ||
          apiErr.message.toLowerCase().includes("another device")
        ) {
          setShowBackupCode(true);
        }
      } finally {
        setIsLoading(false);
      }
    },
    [activeTab, turnstileToken, redirectTo, router, backupCode],
  );

  const onSubmit = useCallback(
    async (data: LoginForm) => {
      if (!turnstileToken) {
        setError("Please complete the captcha verification");
        return;
      }
      await submitPasswordLogin(data, false);
    },
    [turnstileToken, submitPasswordLogin],
  );

  // "Continue" button on the session-conflict modal — replays whichever
  // login flow originally tripped the conflict, this time with
  // confirmReplaceSession set so the backend atomically replaces the old
  // session via createSession's single-session enforcement.
  const onConfirmReplaceSession = useCallback(async () => {
    if (!pendingConflict) return;
    const conflict = pendingConflict;
    setPendingConflict(null);
    if (conflict.kind === "password") {
      await submitPasswordLogin(conflict.data, true);
    } else {
      await onPasskeyLogin(true);
    }
  }, [pendingConflict, submitPasswordLogin, onPasskeyLogin]);

  const identifierLabel = activeTab === "ADMIN" ? "Email" : "Employee ID";
  const identifierPlaceholder = activeTab === "ADMIN" ? "admin@example.com" : "OMG-XXXXXX";

  const { theme, resolvedTheme, setTheme } = useTheme();
  const [themeMounted, setThemeMounted] = useState(false);
  useEffect(() => {
    setThemeMounted(true);
  }, []);
  const isDark = themeMounted && resolvedTheme === "dark";

  return (
    <div className="bg-background flex min-h-screen items-center justify-center px-4">
      {/* Theme toggle — top right corner */}
      <button
        type="button"
        onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        className="text-text-secondary hover:text-text-primary hover:bg-bg-hover fixed top-4 right-4 z-50 rounded-lg p-2 transition-colors"
        aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      >
        {theme === "dark" ? <Sun size={20} /> : <Moon size={20} />}
      </button>

      <div className="w-full max-w-md">
        {/* Logo / Branding */}
        <div className="mb-8 flex justify-center">
          <Image
            src={isDark ? "/icons/logo.png" : "/icons/logo-light-theme.png"}
            alt="Opportunity Makers Group"
            width={280}
            height={70}
            priority
          />
        </div>

        {/* Card */}
        <div className="border-border bg-card rounded-lg border p-6 shadow-xs">
          {/* Tabs — Team (Recruiter + Reporting Manager) vs Admin */}
          <div className="border-border mb-6 flex overflow-hidden rounded-lg border">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => onTabChange(tab.key)}
                className={cn(
                  "flex-1 px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-colors",
                  activeTab === tab.key
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted bg-transparent",
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Error */}
          {error && (
            <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400">
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Identifier */}
            <div>
              <label
                htmlFor="identifier"
                className="text-foreground mb-1.5 block text-sm font-medium"
              >
                {identifierLabel}
              </label>
              <input
                id="identifier"
                type={activeTab === "ADMIN" ? "email" : "text"}
                placeholder={identifierPlaceholder}
                autoComplete={activeTab === "ADMIN" ? "email" : "username"}
                className={cn(
                  "w-full rounded-md border px-3 py-2.5 text-sm outline-hidden transition-colors",
                  "bg-background text-foreground placeholder:text-muted-foreground",
                  "focus:border-ring focus:ring-ring/20 focus:ring-2",
                  formErrors.identifier ? "border-red-500" : "border-border",
                )}
                {...register("identifier", { validate: validateIdentifier })}
                inputMode={activeTab === "ADMIN" ? "email" : "text"}
              />
              {formErrors.identifier && (
                <p className="mt-1 text-xs text-red-500">{formErrors.identifier.message}</p>
              )}
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor="password"
                className="text-foreground mb-1.5 block text-sm font-medium"
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  className={cn(
                    "w-full rounded-md border px-3 py-2.5 pr-10 text-sm outline-hidden transition-colors",
                    "bg-background text-foreground placeholder:text-muted-foreground",
                    "focus:border-ring focus:ring-ring/20 focus:ring-2",
                    formErrors.password ? "border-red-500" : "border-border",
                  )}
                  {...register("password")}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  tabIndex={-1}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="text-muted-foreground hover:text-foreground absolute inset-y-0 right-0 flex items-center pr-3 transition-colors"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {formErrors.password && (
                <p className="mt-1 text-xs text-red-500">{formErrors.password.message}</p>
              )}
            </div>

            {/* §23.16 — Backup code field for device lock bypass */}
            {showBackupCode && (
              <div>
                <label htmlFor="backupCode" className="mb-1 block text-sm font-medium">
                  Backup Code
                </label>
                <input
                  id="backupCode"
                  type="text"
                  placeholder="XXXX-XXXX"
                  value={backupCode}
                  onChange={(e) => setBackupCode(e.target.value)}
                  className={cn(
                    "w-full rounded-md border px-3 py-2 font-mono text-sm tracking-wider uppercase",
                    "border-border bg-bg-input",
                    "focus:border-primary focus:ring-primary/30 focus:ring-2 focus:outline-hidden",
                  )}
                  maxLength={9}
                  autoComplete="one-time-code"
                />
                <p className="text-text-muted mt-1 text-xs">
                  Enter a one-time backup code to bypass device lock. Contact your administrator if
                  you don&apos;t have one.
                </p>
              </div>
            )}
            {!showBackupCode && error.toLowerCase().includes("device") && (
              <button
                type="button"
                onClick={() => setShowBackupCode(true)}
                className="text-primary text-xs underline"
              >
                Have a backup code? Click here to use it
              </button>
            )}

            {/* Turnstile Captcha */}
            <div className="flex justify-center">
              <Turnstile
                onVerify={setTurnstileToken}
                onExpire={() => setTurnstileToken("")}
                onError={() => setTurnstileToken("")}
              />
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading}
              className={cn(
                "w-full rounded-md py-2.5 text-sm font-medium transition-colors",
                "bg-primary text-primary-foreground",
                "focus:ring-ring hover:opacity-90 focus:ring-2 focus:ring-offset-2 focus:outline-hidden",
                "disabled:cursor-not-allowed disabled:opacity-50",
              )}
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Logging in...
                </span>
              ) : (
                "Login"
              )}
            </button>
          </form>

          {/* Passkey Login */}
          {passkeySupported && (
            <>
              <div className="relative my-5">
                <div className="border-border absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-card text-muted-foreground px-2">or</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => void onPasskeyLogin()}
                disabled={passkeyLoading}
                className={cn(
                  "flex w-full items-center justify-center gap-2 rounded-md border py-2.5 text-sm font-medium transition-colors",
                  "border-border bg-background text-foreground",
                  "hover:bg-muted focus:ring-ring focus:ring-2 focus:ring-offset-2 focus:outline-hidden",
                  "disabled:cursor-not-allowed disabled:opacity-50",
                )}
              >
                {passkeyLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Verifying...
                  </span>
                ) : (
                  <>
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M12 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
                      <path d="M7 20.662V19a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v1.662" />
                      <path d="M17 10h.01" />
                      <path d="M19 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" />
                      <path d="M19 12v4l2 2" />
                    </svg>
                    Sign in with Passkey
                  </>
                )}
              </button>
            </>
          )}
        </div>

        {/* Footer text */}
        <p className="text-muted-foreground mt-6 text-center text-xs">
          Contact your administrator if you need access
        </p>
      </div>

      {/* Admin session-conflict confirmation modal — fires when an admin
          tries to log in while already having an active session on another
          device. Continuing replays the original login flow with
          confirmReplaceSession so the backend atomically takes over. */}
      <Modal
        open={pendingConflict !== null}
        onClose={() => setPendingConflict(null)}
        title="You're already logged in"
        size="sm"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="bg-warning-100 text-warning-600 flex h-10 w-10 shrink-0 items-center justify-center rounded-full">
              <AlertTriangle size={20} />
            </div>
            <p className="text-text-secondary text-sm">
              You are currently logged in on another device. Continuing will log you out from
              all other devices and start a new session here.
            </p>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setPendingConflict(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => void onConfirmReplaceSession()}
              loading={isLoading || passkeyLoading}
            >
              Continue
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
