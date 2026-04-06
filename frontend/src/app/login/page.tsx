"use client";

import { useState, useCallback, useEffect } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import axios from "axios";
import { Sun, Moon, Eye, EyeOff } from "lucide-react";
import { useTheme } from "next-themes";
import { extractApiError } from "@/lib/api";
import { getDeviceId } from "@/lib/device-id";
import { Turnstile } from "@/components/common/turnstile";
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

type RoleTab = "RECRUITER" | "REPORTING_MANAGER" | "ADMIN";

const TABS: { key: RoleTab; label: string }[] = ALL_ROLE_OPTIONS.map((r) => ({
  key: r.value as RoleTab,
  label: r.label,
}));

const ROLE_DASHBOARDS: Record<RoleTab, string> = {
  ADMIN: ROUTES.ADMIN_DASHBOARD,
  RECRUITER: ROUTES.DASHBOARD,
  REPORTING_MANAGER: ROUTES.DASHBOARD,
};

const loginSchema = z.object({
  identifier: z.string().min(1, "This field is required"),
  password: z.string().min(1, "Password is required"),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect");

  const [activeTab, setActiveTab] = useState<RoleTab>("RECRUITER");
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

  const {
    register,
    handleSubmit,
    formState: { errors: formErrors },
    reset,
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  // Check passkey support on mount
  useEffect(() => {
    setPasskeySupported(isWebAuthnSupported());
  }, []);

  const onPasskeyLogin = useCallback(async () => {
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
      );
      const role = result.user.role as RoleTab;
      const destination = redirectTo ?? ROLE_DASHBOARDS[role] ?? "/dashboard";
      router.push(destination);
    } catch (err: unknown) {
      // User cancelled the browser prompt
      if (err instanceof Error && err.name === "NotAllowedError") {
        setError("Passkey authentication was cancelled");
      } else {
        const apiErr = extractApiError(err);
        setError(apiErr.message);
      }
    } finally {
      setPasskeyLoading(false);
    }
  }, [redirectTo, router]);

  const onTabChange = useCallback(
    (tab: RoleTab) => {
      setActiveTab(tab);
      setError("");
      reset();
    },
    [reset],
  );

  const onSubmit = useCallback(
    async (data: LoginForm) => {
      if (!turnstileToken) {
        setError("Please complete the captcha verification");
        return;
      }

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
        });

        const role = response.data.user.role as RoleTab;
        const destination = redirectTo ?? ROLE_DASHBOARDS[role] ?? "/dashboard";
        router.push(destination);
      } catch (err) {
        const apiErr = extractApiError(err);
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

  const identifierLabel = activeTab === "ADMIN" ? "Email" : "Employee ID";
  const identifierPlaceholder = activeTab === "ADMIN" ? "admin@example.com" : "OMG-0001";

  const { theme, setTheme } = useTheme();

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
            src={theme === "dark" ? "/icons/logo.png" : "/icons/logo-light-theme.png"}
            alt="Opportunity Makers Group"
            width={280}
            height={70}
            priority
          />
        </div>

        {/* Card */}
        <div className="border-border bg-card rounded-lg border p-6 shadow-xs">
          {/* Tabs */}
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
                {...register("identifier")}
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
    </div>
  );
}
