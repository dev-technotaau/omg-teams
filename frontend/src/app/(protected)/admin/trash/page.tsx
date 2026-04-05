"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Trash2, RotateCcw, Clock, Package, Users as UsersIcon, Building } from "lucide-react";
import { toast } from "sonner";
import { api, extractApiError } from "@/lib/api";
import { bulkRestore } from "@/services/bulk.service";
import { exportToXLSX } from "@/utils/export-table";
import { DEFAULT_LARGE_PAGE_SIZE } from "@/constants/pagination";
import {
  PageHeader,
  Button,
  Tabs,
  DataTable,
  Badge,
  ConfirmDialog,
  SearchInput,
  Card,
} from "@/components/ui";
import type { Column, ViewType, RowDensity } from "@/components/ui";

// ──────────────────────────────────────────────
//  Trash / Deleted Items — Spec Section 23.7
//  View, restore, permanently delete soft-deleted records
// ──────────────────────────────────────────────

interface TrashItem {
  id: string;
  entityType: string;
  name: string;
  deletedAt: string;
  deletedBy: string;
}

interface TrashResponse {
  data: TrashItem[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

const ENTITY_TABS = [
  { id: "", label: "All" },
  { id: "candidate", label: "Candidates" },
  { id: "company", label: "Companies" },
  { id: "serviceProvider", label: "Service Providers" },
  { id: "hrManager", label: "HR Managers" },
  { id: "user", label: "Users" },
];

const ENTITY_BADGE_VARIANT: Record<
  string,
  "primary" | "success" | "warning" | "danger" | "default"
> = {
  candidate: "primary",
  company: "success",
  serviceProvider: "warning",
  hrManager: "danger",
  user: "default",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function TrashPage() {
  const [data, setData] = useState<TrashResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [entityFilter, setEntityFilter] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sortKey, setSortKey] = useState("");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [viewType, setViewType] = useState<ViewType>("table");
  const [density, setDensity] = useState<RowDensity>("default");
  const [confirmAction, setConfirmAction] = useState<{
    type: "restore" | "delete" | "empty" | "bulkRestore" | "bulkDelete";
    item?: TrashItem;
  } | null>(null);

  const fetchTrash = useCallback(async () => {
    setIsLoading(true);
    try {
      const params: Record<string, string> = {
        page: String(page),
        limit: String(DEFAULT_LARGE_PAGE_SIZE),
      };
      if (entityFilter) params["entityType"] = entityFilter;
      if (search) params["search"] = search;
      const res = await api.get<TrashResponse>("/trash", { params });
      setData(res.data);
    } catch (err) {
      toast.error(extractApiError(err).message);
    } finally {
      setIsLoading(false);
    }
  }, [page, entityFilter, search]);

  useEffect(() => {
    void fetchTrash();
  }, [fetchTrash]);

  const handleConfirm = async () => {
    if (!confirmAction) return;
    try {
      switch (confirmAction.type) {
        case "restore":
          await api.post("/trash/restore", {
            entityType: confirmAction.item!.entityType,
            id: confirmAction.item!.id,
          });
          toast.success("Item restored");
          break;
        case "delete":
          await api.post("/trash/permanent-delete", {
            entityType: confirmAction.item!.entityType,
            id: confirmAction.item!.id,
          });
          toast.success("Permanently deleted");
          break;
        case "empty":
          for (const item of data?.data ?? []) {
            await api.post("/trash/permanent-delete", { entityType: item.entityType, id: item.id });
          }
          toast.success("Trash emptied");
          break;
        case "bulkRestore":
          await bulkRestore(Array.from(selected));
          toast.success(`${selected.size} items restored`);
          break;
        case "bulkDelete":
          for (const id of selected) {
            const item = data?.data.find((i) => i.id === id);
            if (item)
              await api.post("/trash/permanent-delete", {
                entityType: item.entityType,
                id: item.id,
              });
          }
          toast.success(`${selected.size} items permanently deleted`);
          break;
      }
      setSelected(new Set());
      void fetchTrash();
    } catch (err) {
      toast.error(extractApiError(err).message);
    }
  };

  const handleSort = useCallback(
    (key: string) => {
      setSortDir((prev) => (sortKey === key && prev === "asc" ? "desc" : "asc"));
      setSortKey(key);
    },
    [sortKey],
  );

  const handleExport = useCallback(() => {
    exportToXLSX(
      data?.data ?? [],
      [
        { header: "Name", accessor: (r) => r.name },
        { header: "Entity Type", accessor: (r) => r.entityType },
        { header: "Deleted At", accessor: (r) => formatDate(r.deletedAt) },
        { header: "Deleted By", accessor: (r) => r.deletedBy },
      ],
      "trash-export",
    );
  }, [data]);

  const sortedItems = useMemo(() => {
    const items = data?.data ?? [];
    if (!sortKey) return items;
    const sorted = [...items].sort((a, b) => {
      let aVal: string | number = "";
      let bVal: string | number = "";
      switch (sortKey) {
        case "name":
          aVal = a.name.toLowerCase();
          bVal = b.name.toLowerCase();
          break;
        case "entityType":
          aVal = a.entityType.toLowerCase();
          bVal = b.entityType.toLowerCase();
          break;
        case "deletedAt":
          aVal = new Date(a.deletedAt).getTime();
          bVal = new Date(b.deletedAt).getTime();
          break;
        default:
          return 0;
      }
      if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [data, sortKey, sortDir]);

  const stats = useMemo(() => {
    const items = data?.data ?? [];
    const total = data?.pagination?.total ?? items.length;
    const candidates = items.filter((i) => i.entityType === "candidate").length;
    const companies = items.filter((i) => i.entityType === "company").length;
    const users = items.filter((i) => i.entityType === "user").length;
    return { total, candidates, companies, users };
  }, [data]);

  const totalPages = data?.pagination.totalPages ?? 1;

  const columns: Column<TrashItem>[] = [
    {
      key: "entityType",
      header: "Entity Type",
      sortable: true,
      cell: (row) => (
        <Badge variant={ENTITY_BADGE_VARIANT[row.entityType] ?? "default"} size="sm">
          {row.entityType}
        </Badge>
      ),
    },
    {
      key: "name",
      header: "Name / Title",
      sortable: true,
      cell: (row) => <span className="text-text-primary font-medium">{row.name}</span>,
    },
    {
      key: "deletedBy",
      header: "Deleted By",
    },
    {
      key: "deletedAt",
      header: "Deleted At",
      sortable: true,
      cell: (row) => <span>{formatDate(row.deletedAt)}</span>,
    },
    {
      key: "actions",
      header: "Actions",
      cell: (row) => (
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="xs"
            leftIcon={RotateCcw}
            onClick={(e) => {
              e.stopPropagation();
              setConfirmAction({ type: "restore", item: row });
            }}
            className="text-success-500 hover:bg-success-100"
          >
            Restore
          </Button>
          <Button
            variant="ghost"
            size="xs"
            leftIcon={Trash2}
            onClick={(e) => {
              e.stopPropagation();
              setConfirmAction({ type: "delete", item: row });
            }}
            className="text-error-500 hover:bg-error-100"
          >
            Delete
          </Button>
        </div>
      ),
    },
  ];

  const cardRenderer = useCallback(
    (row: TrashItem) => (
      <Card padding="sm" className="transition-shadow hover:shadow-md">
        <div className="space-y-2">
          <div className="flex items-start justify-between">
            <p className="text-text-primary font-medium">{row.name}</p>
            <Badge variant={ENTITY_BADGE_VARIANT[row.entityType] ?? "default"} size="sm">
              {row.entityType}
            </Badge>
          </div>
          <div className="text-text-muted text-xs">Deleted by {row.deletedBy}</div>
          <div className="border-border-default flex items-center justify-between border-t pt-2">
            <span className="text-text-muted text-xs">{formatDate(row.deletedAt)}</span>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="xs"
                leftIcon={RotateCcw}
                onClick={() => setConfirmAction({ type: "restore", item: row })}
                className="text-success-500"
              >
                Restore
              </Button>
              <Button
                variant="ghost"
                size="xs"
                leftIcon={Trash2}
                onClick={() => setConfirmAction({ type: "delete", item: row })}
                className="text-error-500"
              >
                Delete
              </Button>
            </div>
          </div>
        </div>
      </Card>
    ),
    [],
  );

  const trashDetailRenderer = useCallback(
    (row: TrashItem) => (
      <div className="space-y-4">
        <p className="text-text-primary text-lg font-semibold">{row.name}</p>
        <div className="border-border-default divide-border-default divide-y rounded-lg border">
          {[
            ["Entity Type", row.entityType],
            ["Deleted By", row.deletedBy],
            ["Deleted At", formatDate(row.deletedAt)],
          ].map(([label, value]) => (
            <div key={String(label)} className="flex justify-between px-4 py-2.5 text-sm">
              <span className="text-text-muted">{label}</span>
              <span className="text-text-primary font-medium">{value}</span>
            </div>
          ))}
        </div>
      </div>
    ),
    [],
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <PageHeader
        title="Trash / Deleted Items"
        actions={
          <Button
            variant="danger"
            leftIcon={Trash2}
            onClick={() => setConfirmAction({ type: "empty" })}
            disabled={!data?.data.length}
          >
            Empty Trash
          </Button>
        }
      />

      {/* Auto-purge notice */}
      <div className="border-border-default bg-warning-100 text-warning-700 flex items-center gap-2 rounded-md border px-4 py-2.5 text-sm">
        <Clock size={16} />
        Items are permanently deleted after 90 days.
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card padding="sm">
          <div className="flex items-center gap-3">
            <div className="bg-error-100 flex h-10 w-10 items-center justify-center rounded-lg">
              <Trash2 size={18} className="text-error-600" />
            </div>
            <div>
              <p className="text-text-muted text-xs">Total Deleted</p>
              <p className="text-text-primary text-xl font-bold">{stats.total}</p>
            </div>
          </div>
        </Card>
        <Card padding="sm">
          <div className="flex items-center gap-3">
            <div className="bg-primary-100 flex h-10 w-10 items-center justify-center rounded-lg">
              <Package size={18} className="text-primary-600" />
            </div>
            <div>
              <p className="text-text-muted text-xs">Candidates</p>
              <p className="text-primary-600 text-xl font-bold">{stats.candidates}</p>
            </div>
          </div>
        </Card>
        <Card padding="sm">
          <div className="flex items-center gap-3">
            <div className="bg-success-100 flex h-10 w-10 items-center justify-center rounded-lg">
              <Building size={18} className="text-success-600" />
            </div>
            <div>
              <p className="text-text-muted text-xs">Companies</p>
              <p className="text-success-600 text-xl font-bold">{stats.companies}</p>
            </div>
          </div>
        </Card>
        <Card padding="sm">
          <div className="flex items-center gap-3">
            <div className="bg-info-100 flex h-10 w-10 items-center justify-center rounded-lg">
              <UsersIcon size={18} className="text-info-600" />
            </div>
            <div>
              <p className="text-text-muted text-xs">Users</p>
              <p className="text-info-600 text-xl font-bold">{stats.users}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Search */}
      <SearchInput
        value={search}
        onChange={(v) => {
          setSearch(v);
          setPage(1);
        }}
        placeholder="Search deleted items..."
        historyKey="trash"
        className="max-w-sm"
      />

      {/* Entity type filter tabs */}
      <Tabs
        tabs={ENTITY_TABS}
        activeTab={entityFilter}
        onChange={(tabId) => {
          setEntityFilter(tabId);
          setPage(1);
          setSelected(new Set());
        }}
      />

      {/* Table */}
      <DataTable<TrashItem>
        columns={columns}
        data={sortedItems}
        loading={isLoading}
        emptyIcon={Trash2}
        emptyTitle="Trash is empty"
        emptyDescription="No deleted items found"
        sortKey={sortKey}
        sortDir={sortDir}
        onSort={handleSort}
        onExport={handleExport}
        stickyHeader
        selectable
        selectedIds={selected}
        onSelectionChange={setSelected}
        getRowId={(row) => row.id}
        viewType={viewType}
        onViewTypeChange={setViewType}
        cardRenderer={cardRenderer}
        bulkActions={[
          {
            label: "Restore Selected",
            icon: RotateCcw,
            onClick: () => setConfirmAction({ type: "bulkRestore" }),
          },
          {
            label: "Delete Selected",
            icon: Trash2,
            onClick: () => setConfirmAction({ type: "bulkDelete" }),
            variant: "danger",
          },
        ]}
        page={page}
        totalPages={totalPages}
        total={data?.pagination.total}
        pageSize={DEFAULT_LARGE_PAGE_SIZE}
        onPageChange={setPage}
        enableColumnVisibility
        density={density}
        onDensityChange={setDensity}
        detailRenderer={trashDetailRenderer}
        detailTitle={(r) => r.name}
        enableKeyboardNav
      />

      {/* Confirm Dialog */}
      <ConfirmDialog
        open={!!confirmAction}
        onClose={() => setConfirmAction(null)}
        onConfirm={handleConfirm}
        title={
          confirmAction?.type === "restore"
            ? "Restore Item"
            : confirmAction?.type === "delete"
              ? "Permanently Delete"
              : confirmAction?.type === "empty"
                ? "Empty Trash"
                : confirmAction?.type === "bulkRestore"
                  ? "Restore Selected Items"
                  : "Delete Selected Items"
        }
        description={
          confirmAction?.type === "restore"
            ? `Restore "${confirmAction.item?.name}" to its original location?`
            : confirmAction?.type === "delete"
              ? `Permanently delete "${confirmAction.item?.name}"? This cannot be undone.`
              : confirmAction?.type === "empty"
                ? "Permanently delete all items in trash? This cannot be undone."
                : confirmAction?.type === "bulkRestore"
                  ? `Restore ${selected.size} selected items?`
                  : `Permanently delete ${selected.size} selected items? This cannot be undone.`
        }
        confirmLabel={
          confirmAction?.type === "restore" || confirmAction?.type === "bulkRestore"
            ? "Restore"
            : "Delete"
        }
        variant={
          confirmAction?.type === "restore" || confirmAction?.type === "bulkRestore"
            ? "default"
            : "danger"
        }
      />
    </div>
  );
}
