"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";

// ──────────────────────────────────────────────
//  §25.2 — Password Strength Indicator
//  Real-time feedback showing which requirements are met/unmet.
// ──────────────────────────────────────────────

interface PasswordStrengthProps {
  password: string;
  className?: string;
}

interface Requirement {
  label: string;
  met: boolean;
}

export function PasswordStrength({ password, className }: PasswordStrengthProps) {
  const requirements = useMemo<Requirement[]>(() => {
    if (!password) return [];
    return [
      { label: "At least 8 characters", met: password.length >= 8 },
      { label: "Uppercase letter (A-Z)", met: /[A-Z]/.test(password) },
      { label: "Lowercase letter (a-z)", met: /[a-z]/.test(password) },
      { label: "Number (0-9)", met: /\d/.test(password) },
      {
        label: "Special character (!@#$...)",
        met: /[!@#$%^&*()\-_+=[\]{};':"\\|,.<>/?]/.test(password),
      },
    ];
  }, [password]);

  if (!password) return null;

  const metCount = requirements.filter((r) => r.met).length;
  const total = requirements.length;
  const strength = metCount === total ? "strong" : metCount >= 3 ? "fair" : "weak";
  const strengthColor =
    strength === "strong"
      ? "bg-success-500"
      : strength === "fair"
        ? "bg-warning-500"
        : "bg-error-500";
  const strengthLabel = strength === "strong" ? "Strong" : strength === "fair" ? "Fair" : "Weak";

  return (
    <div className={cn("mt-2 space-y-2", className)}>
      {/* Strength bar */}
      <div className="flex items-center gap-2">
        <div className="bg-bg-muted h-1.5 flex-1 overflow-hidden rounded-full">
          <div
            className={cn("h-full rounded-full transition-all", strengthColor)}
            style={{ width: `${(metCount / total) * 100}%` }}
          />
        </div>
        <span
          className={cn(
            "text-xs font-medium",
            strength === "strong"
              ? "text-success-600"
              : strength === "fair"
                ? "text-warning-600"
                : "text-error-600",
          )}
        >
          {strengthLabel}
        </span>
      </div>

      {/* Requirements checklist */}
      <ul className="space-y-0.5">
        {requirements.map((req) => (
          <li key={req.label} className="flex items-center gap-1.5 text-xs">
            <span className={req.met ? "text-success-500" : "text-text-muted"}>
              {req.met ? "\u2713" : "\u2022"}
            </span>
            <span className={req.met ? "text-success-700" : "text-text-muted"}>{req.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
