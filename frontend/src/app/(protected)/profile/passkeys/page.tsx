"use client";

import { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { qk } from "@/lib/query-keys";
import { Fingerprint, Plus, Pencil, Trash2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import {
  isWebAuthnSupported,
  getRegisterOptions,
  registerCredential,
  listCredentials,
  renameCredential,
  deleteCredential,
  type WebAuthnCredential,
} from "@/services/webauthn.service";
import { startRegistration } from "@simplewebauthn/browser";
import {
  PageHeader,
  Card,
  Button,
  Input,
  FormField,
  ConfirmDialog,
  Badge,
  EmptyState,
  TableSkeleton,
} from "@/components/ui";

// ──────────────────────────────────────────────
//  Passkey Management Page
// ──────────────────────────────────────────────

export default function PasskeysPage() {
  const qc = useQueryClient();
  const credentialsQuery = useQuery({
    queryKey: qk.passkeys.list(),
    queryFn: listCredentials,
  });
  const credentials: WebAuthnCredential[] = credentialsQuery.data ?? [];
  const loading = credentialsQuery.isLoading;
  const fetchCredentials = useCallback(
    () => qc.invalidateQueries({ queryKey: qk.passkeys.all() }),
    [qc],
  );

  const [registering, setRegistering] = useState(false);
  const [deviceName, setDeviceName] = useState("");
  const [showRegister, setShowRegister] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const supported = isWebAuthnSupported();

  const handleRegister = async () => {
    if (!supported) return;
    setRegistering(true);
    try {
      const options = await getRegisterOptions();

      const attResp = await startRegistration({ optionsJSON: options });
      await registerCredential(
        attResp as unknown as Record<string, unknown>,
        deviceName || undefined,
      );
      toast.success("Passkey registered successfully");
      setShowRegister(false);
      setDeviceName("");
      void fetchCredentials();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Registration failed";
      toast.error(msg);
    } finally {
      setRegistering(false);
    }
  };

  const handleRename = async () => {
    if (!editId || !editName.trim()) return;
    try {
      await renameCredential(editId, editName.trim());
      toast.success("Passkey renamed");
      setEditId(null);
      void fetchCredentials();
    } catch {
      toast.error("Failed to rename passkey");
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteCredential(deleteId);
      toast.success("Passkey removed");
      setDeleteId(null);
      void fetchCredentials();
    } catch {
      toast.error("Failed to delete passkey");
    }
  };

  if (!supported) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="flex items-center gap-3">
          <Link
            href="/profile"
            className="text-text-muted hover:text-text-primary rounded-lg p-1 transition-colors"
          >
            <ArrowLeft size={20} />
          </Link>
          <PageHeader title="Passkeys" />
        </div>
        <Card>
          <Card.Body>
            <EmptyState
              icon={Fingerprint}
              title="WebAuthn Not Supported"
              description="Your browser does not support passkeys. Try a modern browser like Chrome, Safari, or Edge."
            />
          </Card.Body>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/profile"
            className="text-text-muted hover:text-text-primary rounded-lg p-1 transition-colors"
          >
            <ArrowLeft size={20} />
          </Link>
          <PageHeader title="Passkeys" />
        </div>
        <Button leftIcon={Plus} onClick={() => setShowRegister(true)} size="sm">
          Add Passkey
        </Button>
      </div>

      {/* Registration form */}
      {showRegister && (
        <Card>
          <Card.Header>
            <h3 className="text-text-primary font-semibold">Register New Passkey</h3>
            <p className="text-text-muted mt-1 text-sm">
              Your browser will prompt you to use a fingerprint, face, or security key.
            </p>
          </Card.Header>
          <Card.Body className="space-y-4">
            <FormField label="Device Name (optional)" htmlFor="device-name">
              <Input
                id="device-name"
                value={deviceName}
                onChange={(e) => setDeviceName(e.target.value)}
                placeholder='e.g., "MacBook Touch ID", "YubiKey"'
                maxLength={100}
              />
            </FormField>
            <div className="flex gap-3">
              <Button
                leftIcon={Fingerprint}
                loading={registering}
                onClick={() => void handleRegister()}
              >
                Register Passkey
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowRegister(false);
                  setDeviceName("");
                }}
              >
                Cancel
              </Button>
            </div>
          </Card.Body>
        </Card>
      )}

      {/* Credentials list */}
      {loading ? (
        <TableSkeleton rows={3} />
      ) : credentials.length === 0 ? (
        <Card>
          <Card.Body>
            <EmptyState
              icon={Fingerprint}
              title="No Passkeys Registered"
              description="Add a passkey for faster, more secure authentication."
              action={
                <Button leftIcon={Plus} onClick={() => setShowRegister(true)} size="sm">
                  Add Your First Passkey
                </Button>
              }
            />
          </Card.Body>
        </Card>
      ) : (
        <div className="space-y-3">
          {credentials.map((cred) => (
            <Card key={cred.id}>
              <Card.Body>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="bg-primary-50 text-primary-600 flex h-10 w-10 items-center justify-center rounded-lg">
                      <Fingerprint size={20} />
                    </div>
                    <div>
                      {editId === cred.id ? (
                        <div className="flex items-center gap-2">
                          <Input
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="h-8 w-48 text-sm"
                            maxLength={100}
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === "Enter") void handleRename();
                              if (e.key === "Escape") setEditId(null);
                            }}
                          />
                          <Button size="sm" onClick={() => void handleRename()}>
                            Save
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setEditId(null)}>
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <>
                          <p className="text-text-primary font-medium">
                            {cred.deviceName || "Unnamed Passkey"}
                          </p>
                          <p className="text-text-muted text-xs">
                            Added {new Date(cred.createdAt).toLocaleDateString()}
                            {cred.lastUsedAt
                              ? ` \u00b7 Last used ${new Date(cred.lastUsedAt).toLocaleDateString()}`
                              : " \u00b7 Never used"}
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                  {editId !== cred.id && (
                    <div className="flex items-center gap-2">
                      {cred.transports.length > 0 && (
                        <div className="flex gap-1">
                          {cred.transports.map((t) => (
                            <Badge key={t} variant="info" size="sm">
                              {t}
                            </Badge>
                          ))}
                        </div>
                      )}
                      <button
                        onClick={() => {
                          setEditId(cred.id);
                          setEditName(cred.deviceName || "");
                        }}
                        className="text-text-muted hover:text-primary-500 rounded p-1.5 transition-colors"
                        title="Rename"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => setDeleteId(cred.id)}
                        className="text-text-muted hover:text-error-500 rounded p-1.5 transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </div>
              </Card.Body>
            </Card>
          ))}
        </div>
      )}

      {/* Delete confirmation */}
      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => void handleDelete()}
        title="Remove Passkey"
        description="This passkey will be permanently removed. You won't be able to use it for authentication anymore."
        confirmLabel="Remove"
        variant="danger"
      />
    </div>
  );
}
