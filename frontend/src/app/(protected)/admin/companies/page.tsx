"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { qk } from "@/lib/query-keys";
import { toastApiError } from "@/lib/query-helpers";
import { Plus, Building2, ChevronDown, ChevronRight, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import {
  listCompanies,
  createCompany,
  deleteCompany,
  createServiceProvider,
  createHRManager,
  updateServiceProvider,
  deleteServiceProvider,
  updateHRManager,
  deleteHRManager,
  type Company,
} from "@/services/company.service";
import { createCompanySchema } from "@/validators/company";
import {
  PageHeader,
  SearchInput,
  Card,
  Button,
  IconButton,
  Modal,
  FormField,
  Input,
  EmptyState,
  ConfirmDialog,
  Tooltip,
} from "@/components/ui";

export default function CompaniesPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [addSP, setAddSP] = useState<string | null>(null);
  const [addHR, setAddHR] = useState<string | null>(null);

  // Form state for create company
  const [companyName, setCompanyName] = useState("");
  // Form state for add SP
  const [spName, setSpName] = useState("");
  // Form state for add HR
  const [hrName, setHrName] = useState("");
  const [hrEmail, setHrEmail] = useState("");
  const [hrPhone, setHrPhone] = useState("");
  // Edit/delete SP
  const [editSP, setEditSP] = useState<{ id: string; name: string } | null>(null);
  const [deleteSPTarget, setDeleteSPTarget] = useState<{ id: string; name: string } | null>(null);
  // Edit/delete HR
  const [editHR, setEditHR] = useState<{
    id: string;
    name: string;
    email: string;
    phone: string;
  } | null>(null);
  const [deleteHRTarget, setDeleteHRTarget] = useState<{ id: string; name: string } | null>(null);

  // Server state — companies query, keyed by search so each search hits cache.
  const { data: companies = [], isLoading } = useQuery({
    queryKey: qk.companies.list({ search }),
    queryFn: () => listCompanies(search || undefined),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: qk.companies.lists() });

  // ── Mutations ──
  // The companies tree (companies → SPs → HRs) is heavily nested, so each
  // mutation just invalidates the list rather than reaching into the cache
  // shape. The list refetch is fast enough that the user perceives it as
  // instant; we still get the no-skeleton UX because background refetches
  // keep the previous data visible.
  const createCompanyMutation = useMutation({
    mutationFn: (name: string) => createCompany(name),
    onSuccess: () => {
      setShowCreate(false);
      setCompanyName("");
      toast.success("Company created");
      void invalidate();
    },
    onError: (err) => toastApiError(err, "Failed to create company"),
  });

  const deleteCompanyMutation = useMutation({
    mutationFn: deleteCompany,
    onMutate: async (id: string) => {
      const key = qk.companies.list({ search });
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<Company[]>(key);
      qc.setQueryData<Company[]>(key, (old) => (old ?? []).filter((c) => c.id !== id));
      return { prev, key };
    },
    onError: (err, _id, ctx) => {
      if (ctx) qc.setQueryData(ctx.key, ctx.prev);
      toastApiError(err, "Failed to delete");
    },
    onSuccess: () => {
      toast.success("Company deleted");
      setDeleteTarget(null);
    },
    onSettled: () => void invalidate(),
  });

  const createSPMutation = useMutation({
    mutationFn: ({ name, companyId }: { name: string; companyId: string }) =>
      createServiceProvider(name, companyId),
    onSuccess: () => {
      setAddSP(null);
      setSpName("");
      toast.success("Service Provider added");
      void invalidate();
    },
    onError: (err) => toastApiError(err, "Failed to add"),
  });

  const updateSPMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      updateServiceProvider(id, { name }),
    onSuccess: () => {
      setEditSP(null);
      toast.success("Service Provider updated");
      void invalidate();
    },
    onError: (err) => toastApiError(err, "Failed to update"),
  });

  const deleteSPMutation = useMutation({
    mutationFn: deleteServiceProvider,
    onSuccess: () => {
      setDeleteSPTarget(null);
      toast.success("Service Provider deleted");
      void invalidate();
    },
    onError: (err) => toastApiError(err, "Failed to delete"),
  });

  const createHRMutation = useMutation({
    mutationFn: createHRManager,
    onSuccess: () => {
      setAddHR(null);
      setHrName("");
      setHrEmail("");
      setHrPhone("");
      toast.success("HR Manager added");
      void invalidate();
    },
    onError: (err) => toastApiError(err, "Failed to add"),
  });

  const updateHRMutation = useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: Parameters<typeof updateHRManager>[1];
    }) => updateHRManager(id, payload),
    onSuccess: () => {
      setEditHR(null);
      toast.success("HR Manager updated");
      void invalidate();
    },
    onError: (err) => toastApiError(err, "Failed to update"),
  });

  const deleteHRMutation = useMutation({
    mutationFn: deleteHRManager,
    onSuccess: () => {
      setDeleteHRTarget(null);
      toast.success("HR Manager deleted");
      void invalidate();
    },
    onError: (err) => toastApiError(err, "Failed to delete"),
  });

  // ── Handler facades — UI components keep their existing call sites ──
  const handleCreate = () => {
    const parsed = createCompanySchema.safeParse({ name: companyName });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Validation failed");
      return;
    }
    createCompanyMutation.mutate(parsed.data.name);
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteCompanyMutation.mutate(deleteTarget.id);
  };

  const handleAddSP = () => {
    if (!addSP) return;
    createSPMutation.mutate({ name: spName, companyId: addSP });
  };

  const handleAddHR = () => {
    if (!addHR) return;
    createHRMutation.mutate({
      name: hrName,
      companyId: addHR,
      ...(hrEmail ? { email: hrEmail } : {}),
      ...(hrPhone ? { phone: hrPhone } : {}),
    });
  };

  const handleEditSP = () => {
    if (!editSP) return;
    updateSPMutation.mutate({ id: editSP.id, name: editSP.name });
  };

  const handleDeleteSP = () => {
    if (!deleteSPTarget) return;
    deleteSPMutation.mutate(deleteSPTarget.id);
  };

  const handleEditHR = () => {
    if (!editHR) return;
    updateHRMutation.mutate({
      id: editHR.id,
      payload: {
        name: editHR.name,
        ...(editHR.email ? { email: editHR.email } : {}),
        ...(editHR.phone ? { phone: editHR.phone } : {}),
      },
    });
  };

  const handleDeleteHR = () => {
    if (!deleteHRTarget) return;
    deleteHRMutation.mutate(deleteHRTarget.id);
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Companies"
        actions={
          <Button leftIcon={Plus} onClick={() => setShowCreate(true)}>
            Add Company
          </Button>
        }
      />

      <SearchInput
        value={search}
        onChange={setSearch}
        onSearch={() => void invalidate()}
        placeholder="Search companies..."
        historyKey="companies"
        suggestions
        className="max-w-sm"
      />

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-bg-muted h-16 animate-pulse rounded-lg" />
          ))}
        </div>
      ) : companies.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No companies yet"
          description="Add your first company to get started"
        />
      ) : (
        <div className="space-y-2">
          {companies.map((company) => {
            const isExpanded = expandedId === company.id;
            return (
              <Card key={company.id} padding="sm">
                <div
                  className="focus-visible:ring-primary-500 flex cursor-pointer items-center justify-between rounded focus-visible:ring-2 focus-visible:outline-hidden"
                  role="button"
                  tabIndex={0}
                  onClick={() => setExpandedId(isExpanded ? null : company.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setExpandedId(isExpanded ? null : company.id);
                    }
                  }}
                  aria-expanded={isExpanded}
                >
                  <div className="flex items-center gap-3">
                    {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    <div>
                      <p className="text-text-primary font-medium">{company.name}</p>
                      <p className="text-text-muted text-xs">
                        {company.serviceProviders.length} SPs &middot; {company.hrManagers.length}{" "}
                        HRs &middot; {company._count.candidateReports} candidates
                      </p>
                    </div>
                  </div>
                  <Tooltip content="Delete company">
                    <IconButton
                      icon={Trash2}
                      aria-label="Delete company"
                      variant="danger"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteTarget({ id: company.id, name: company.name });
                      }}
                    />
                  </Tooltip>
                </div>

                {isExpanded && (
                  <div className="border-border-default mt-3 space-y-3 border-t pt-3">
                    {/* Service Providers */}
                    <div>
                      <div className="mb-2 flex items-center justify-between">
                        <h4 className="text-text-muted text-xs font-medium uppercase">
                          Service Providers
                        </h4>
                        <Button variant="ghost" size="xs" onClick={() => setAddSP(company.id)}>
                          + Add
                        </Button>
                      </div>
                      {company.serviceProviders.length === 0 ? (
                        <p className="text-text-muted text-xs">None</p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {company.serviceProviders.map((sp) => (
                            <div
                              key={sp.id}
                              className="bg-surface-secondary flex items-center gap-1 rounded px-2 py-1"
                            >
                              <span className="text-text-primary text-xs">{sp.name}</span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditSP({ id: sp.id, name: sp.name });
                                }}
                                className="text-text-muted hover:text-primary-500 ml-1"
                                title="Edit"
                              >
                                <Pencil size={10} />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeleteSPTarget({ id: sp.id, name: sp.name });
                                }}
                                className="text-text-muted hover:text-error-500"
                                title="Delete"
                              >
                                <Trash2 size={10} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* HR Managers */}
                    <div>
                      <div className="mb-2 flex items-center justify-between">
                        <h4 className="text-text-muted text-xs font-medium uppercase">
                          HR Managers
                        </h4>
                        <Button variant="ghost" size="xs" onClick={() => setAddHR(company.id)}>
                          + Add
                        </Button>
                      </div>
                      {company.hrManagers.length === 0 ? (
                        <p className="text-text-muted text-xs">None</p>
                      ) : (
                        <div className="space-y-1">
                          {company.hrManagers.map((hr) => (
                            <div key={hr.id} className="flex items-center gap-2 text-xs">
                              <span className="text-text-primary font-medium">{hr.name}</span>
                              {hr.email && <span className="text-text-muted">{hr.email}</span>}
                              {hr.phone && <span className="text-text-muted">{hr.phone}</span>}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditHR({
                                    id: hr.id,
                                    name: hr.name,
                                    email: hr.email ?? "",
                                    phone: hr.phone ?? "",
                                  });
                                }}
                                className="text-text-muted hover:text-primary-500 ml-1"
                                title="Edit"
                              >
                                <Pencil size={10} />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeleteHRTarget({ id: hr.id, name: hr.name });
                                }}
                                className="text-text-muted hover:text-error-500"
                                title="Delete"
                              >
                                <Trash2 size={10} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Create Company Modal */}
      <Modal
        open={showCreate}
        onClose={() => {
          setShowCreate(false);
          setCompanyName("");
        }}
        title="Add Company"
        size="sm"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => {
                setShowCreate(false);
                setCompanyName("");
              }}
            >
              Cancel
            </Button>
            <Button onClick={() => void handleCreate()} disabled={!companyName.trim()}>
              Create
            </Button>
          </>
        }
      >
        <FormField label="Company Name" required htmlFor="companyName">
          <Input
            id="companyName"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && companyName.trim()) void handleCreate();
            }}
            placeholder="Company Name"
            autoFocus
          />
        </FormField>
      </Modal>

      {/* Add SP Modal */}
      <Modal
        open={!!addSP}
        onClose={() => {
          setAddSP(null);
          setSpName("");
        }}
        title="Add Service Provider"
        size="sm"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => {
                setAddSP(null);
                setSpName("");
              }}
            >
              Cancel
            </Button>
            <Button onClick={() => void handleAddSP()} disabled={!spName.trim()}>
              Add
            </Button>
          </>
        }
      >
        <FormField label="Service Provider Name" required htmlFor="spName">
          <Input
            id="spName"
            value={spName}
            onChange={(e) => setSpName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && spName.trim()) void handleAddSP();
            }}
            placeholder="Service Provider Name"
            autoFocus
          />
        </FormField>
      </Modal>

      {/* Add HR Modal */}
      <Modal
        open={!!addHR}
        onClose={() => {
          setAddHR(null);
          setHrName("");
          setHrEmail("");
          setHrPhone("");
        }}
        title="Add HR Manager"
        size="sm"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => {
                setAddHR(null);
                setHrName("");
                setHrEmail("");
                setHrPhone("");
              }}
            >
              Cancel
            </Button>
            <Button onClick={() => void handleAddHR()} disabled={!hrName.trim()}>
              Add
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <FormField label="Name" required htmlFor="hrName">
            <Input
              id="hrName"
              value={hrName}
              onChange={(e) => setHrName(e.target.value)}
              placeholder="Name"
              autoFocus
            />
          </FormField>
          <FormField label="Email" htmlFor="hrEmail">
            <Input
              id="hrEmail"
              type="email"
              value={hrEmail}
              onChange={(e) => setHrEmail(e.target.value)}
              placeholder="Email (optional)"
            />
          </FormField>
          <FormField label="Phone" htmlFor="hrPhone">
            <Input
              id="hrPhone"
              value={hrPhone}
              onChange={(e) => setHrPhone(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && hrName.trim()) void handleAddHR();
              }}
              placeholder="Phone (optional)"
            />
          </FormField>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Company"
        description={`Delete "${deleteTarget?.name}"? This will also remove its Service Providers and HR Managers.`}
        confirmLabel="Delete"
        variant="danger"
      />

      {/* Edit SP Modal */}
      <Modal
        open={!!editSP}
        onClose={() => setEditSP(null)}
        title="Edit Service Provider"
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setEditSP(null)}>
              Cancel
            </Button>
            <Button onClick={() => void handleEditSP()} disabled={!editSP?.name.trim()}>
              Save
            </Button>
          </>
        }
      >
        <FormField label="Name" required htmlFor="editSpName">
          <Input
            id="editSpName"
            value={editSP?.name ?? ""}
            onChange={(e) => setEditSP((prev) => (prev ? { ...prev, name: e.target.value } : null))}
            onKeyDown={(e) => {
              if (e.key === "Enter" && editSP?.name.trim()) void handleEditSP();
            }}
            placeholder="Service Provider Name"
            autoFocus
          />
        </FormField>
      </Modal>

      {/* Delete SP Confirm */}
      <ConfirmDialog
        open={!!deleteSPTarget}
        onClose={() => setDeleteSPTarget(null)}
        onConfirm={() => void handleDeleteSP()}
        title="Delete Service Provider"
        description={`Delete "${deleteSPTarget?.name}"? Candidates linked to this provider will be unlinked.`}
        confirmLabel="Delete"
        variant="danger"
      />

      {/* Edit HR Modal */}
      <Modal
        open={!!editHR}
        onClose={() => setEditHR(null)}
        title="Edit HR Manager"
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setEditHR(null)}>
              Cancel
            </Button>
            <Button onClick={() => void handleEditHR()} disabled={!editHR?.name.trim()}>
              Save
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <FormField label="Name" required htmlFor="editHrName">
            <Input
              id="editHrName"
              value={editHR?.name ?? ""}
              onChange={(e) =>
                setEditHR((prev) => (prev ? { ...prev, name: e.target.value } : null))
              }
              placeholder="Name"
            />
          </FormField>
          <FormField label="Email" htmlFor="editHrEmail">
            <Input
              id="editHrEmail"
              type="email"
              value={editHR?.email ?? ""}
              onChange={(e) =>
                setEditHR((prev) => (prev ? { ...prev, email: e.target.value } : null))
              }
              placeholder="Email (optional)"
            />
          </FormField>
          <FormField label="Phone" htmlFor="editHrPhone">
            <Input
              id="editHrPhone"
              value={editHR?.phone ?? ""}
              onChange={(e) =>
                setEditHR((prev) => (prev ? { ...prev, phone: e.target.value } : null))
              }
              onKeyDown={(e) => {
                if (e.key === "Enter" && editHR?.name.trim()) void handleEditHR();
              }}
              placeholder="Phone (optional)"
            />
          </FormField>
        </div>
      </Modal>

      {/* Delete HR Confirm */}
      <ConfirmDialog
        open={!!deleteHRTarget}
        onClose={() => setDeleteHRTarget(null)}
        onConfirm={() => void handleDeleteHR()}
        title="Delete HR Manager"
        description={`Delete "${deleteHRTarget?.name}"? Candidates linked to this HR Manager will be unlinked.`}
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  );
}
