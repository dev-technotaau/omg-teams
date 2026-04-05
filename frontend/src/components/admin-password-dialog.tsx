"use client";

import { useState, useEffect } from "react";
import { ShieldCheck, AlertCircle } from "lucide-react";
import { Modal, FormField, Input, Button } from "@/components/ui";
import { api } from "@/lib/api";

// ──────────────────────────────────────────────
//  Admin Password Verification Dialog
//  Spec Section 12.8 — Admin verifies own
//  password before sensitive actions.
//  Caches verification for 5 minutes.
// ──────────────────────────────────────────────

const CACHE_KEY = "admin_pw_verified_at";
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

interface AdminPasswordDialogProps {
  open: boolean;
  onClose: () => void;
  onVerified: () => void;
  title?: string;
}

function isRecentlyVerified(): boolean {
  try {
    const ts = sessionStorage.getItem(CACHE_KEY);
    if (!ts) return false;
    return Date.now() - Number(ts) < CACHE_DURATION_MS;
  } catch {
    return false;
  }
}

function markVerified(): void {
  try {
    sessionStorage.setItem(CACHE_KEY, String(Date.now()));
  } catch {
    // sessionStorage unavailable
  }
}

export function AdminPasswordDialog({
  open,
  onClose,
  onVerified,
  title,
}: AdminPasswordDialogProps) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Auto-verify if recently verified
  useEffect(() => {
    if (open && isRecentlyVerified()) {
      onVerified();
    }
  }, [open, onVerified]);

  // Reset on open
  useEffect(() => {
    if (open) {
      setPassword("");
      setError("");
    }
  }, [open]);

  const handleSubmit = async () => {
    if (!password.trim()) {
      setError("Please enter your password");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await api.post("/auth/verify-password", { password });
      markVerified();
      onVerified();
    } catch {
      setError("Incorrect password. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Skip rendering if cached verification is valid
  if (open && isRecentlyVerified()) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title ?? "Admin Verification Required"}
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            loading={loading}
            disabled={!password.trim()}
            onClick={() => void handleSubmit()}
            leftIcon={ShieldCheck}
          >
            Verify
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-text-secondary text-sm">
          Please enter your admin password to continue with this sensitive action.
        </p>

        <FormField label="Password" required htmlFor="admin-verify-pw">
          <Input
            id="admin-verify-pw"
            type="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError("");
            }}
            placeholder="Enter your password"
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleSubmit();
            }}
            autoFocus
          />
        </FormField>

        {error && (
          <div className="bg-error-100 text-error-700 flex items-center gap-2 rounded-md px-3 py-2 text-sm">
            <AlertCircle size={14} />
            {error}
          </div>
        )}

        <p className="text-text-muted text-xs">Verification is cached for 5 minutes.</p>
      </div>
    </Modal>
  );
}
