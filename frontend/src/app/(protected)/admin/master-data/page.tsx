"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Plus, GripVertical, Pencil, ChevronUp, ChevronDown, X, Check, List } from "lucide-react";
import { toast } from "sonner";
import { api, extractApiError } from "@/lib/api";
import {
  PageHeader,
  Tabs,
  DataTable,
  Badge,
  Button,
  IconButton,
  Tooltip,
  Modal,
  FormField,
  Input,
  Select,
} from "@/components/ui";
import type { Column } from "@/components/ui";
import { cn } from "@/lib/utils";

// ──────────────────────────────────────────────
//  Master Data / Dropdown Options — Spec Section 23.19
//  Admin-configurable dropdown values
// ──────────────────────────────────────────────

interface DropdownItem {
  id: string;
  label: string;
  value: string;
  zoneSet: "ALL" | "SET_A" | "SET_B";
  sortOrder: number;
  isActive: boolean;
}

const CATEGORIES = [
  { key: "state", label: "State", hasZone: false },
  { key: "location", label: "Location", hasZone: true },
  { key: "profile", label: "Profile", hasZone: true },
  { key: "higher_qualification", label: "Higher Qualification", hasZone: false },
  { key: "notice_period", label: "Notice Period", hasZone: false },
  { key: "diploma_type", label: "Diploma Type", hasZone: false },
  { key: "hr_feedback", label: "HR Feedback", hasZone: false },
  { key: "payment_status", label: "Payment Status", hasZone: false },
] as const;

const ZONE_TABS = [
  { id: "ALL", label: "All" },
  { id: "SET_A", label: "Set A" },
  { id: "SET_B", label: "Set B" },
];

const ZONE_OPTIONS = [
  { value: "ALL", label: "All" },
  { value: "SET_A", label: "Set A" },
  { value: "SET_B", label: "Set B" },
];

const ZONE_BADGE_VARIANT: Record<string, "default" | "success" | "warning"> = {
  ALL: "default",
  SET_A: "success",
  SET_B: "warning",
};

const CATEGORY_TABS = CATEGORIES.map((c) => ({ id: c.key, label: c.label }));

export default function MasterDataPage() {
  const [activeCategory, setActiveCategory] = useState("state");
  const [items, setItems] = useState<DropdownItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [zoneFilter, setZoneFilter] = useState("ALL");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ label: "", value: "" });
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ label: "", value: "", zoneSet: "ALL" });

  const categoryDef = CATEGORIES.find((c) => c.key === activeCategory)!;

  const fetchItems = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await api.get<{ data: DropdownItem[] }>(`/dropdowns/${activeCategory}`);
      setItems(res.data.data);
    } catch (err) {
      toast.error(extractApiError(err).message);
    } finally {
      setIsLoading(false);
    }
  }, [activeCategory]);

  useEffect(() => {
    void fetchItems();
  }, [fetchItems]);

  useEffect(() => {
    setZoneFilter("ALL");
    setEditingId(null);
    setShowAdd(false);
  }, [activeCategory]);

  const filteredItems =
    categoryDef.hasZone && zoneFilter !== "ALL"
      ? items.filter((i) => i.zoneSet === zoneFilter || i.zoneSet === "ALL")
      : items;

  const sortedItems = useMemo(
    () => [...filteredItems].sort((a, b) => a.sortOrder - b.sortOrder),
    [filteredItems],
  );

  const handleAdd = async () => {
    if (!addForm.label.trim() || !addForm.value.trim()) {
      toast.error("Label and value are required");
      return;
    }
    try {
      await api.post("/dropdowns", {
        fieldKey: activeCategory,
        label: addForm.label,
        value: addForm.value,
        zoneSet: categoryDef.hasZone ? addForm.zoneSet : "ALL",
      });
      toast.success("Option added");
      setShowAdd(false);
      setAddForm({ label: "", value: "", zoneSet: "ALL" });
      void fetchItems();
    } catch (err) {
      toast.error(extractApiError(err).message);
    }
  };

  const handleEdit = async (id: string) => {
    if (!editForm.label.trim() || !editForm.value.trim()) {
      toast.error("Label and value are required");
      return;
    }
    try {
      await api.patch(`/dropdowns/${id}`, { label: editForm.label, value: editForm.value });
      toast.success("Option updated");
      setEditingId(null);
      void fetchItems();
    } catch (err) {
      toast.error(extractApiError(err).message);
    }
  };

  const toggleActive = async (item: DropdownItem) => {
    try {
      await api.patch(`/dropdowns/${item.id}`, { isActive: !item.isActive });
      toast.success(item.isActive ? "Option deactivated" : "Option activated");
      void fetchItems();
    } catch (err) {
      toast.error(extractApiError(err).message);
    }
  };

  const moveItem = async (item: DropdownItem, direction: "up" | "down") => {
    const idx = sortedItems.findIndex((i) => i.id === item.id);
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sortedItems.length) return;

    const reordered = sortedItems.map((it, i) => ({
      id: it.id,
      sortOrder:
        i === idx
          ? sortedItems[swapIdx].sortOrder
          : i === swapIdx
            ? sortedItems[idx].sortOrder
            : it.sortOrder,
    }));

    try {
      await api.post("/dropdowns/reorder", { items: reordered });
      void fetchItems();
    } catch (err) {
      toast.error(extractApiError(err).message);
    }
  };

  const startEdit = (item: DropdownItem) => {
    setEditingId(item.id);
    setEditForm({ label: item.label, value: item.value });
  };

  const columns = useMemo<Column<DropdownItem>[]>(() => {
    const cols: Column<DropdownItem>[] = [
      {
        key: "grip",
        header: "",
        width: "40px",
        cell: () => <GripVertical size={14} className="text-text-muted" />,
      },
      {
        key: "label",
        header: "Label",
        cell: (item) =>
          editingId === item.id ? (
            <Input
              value={editForm.label}
              onChange={(e) => setEditForm((f) => ({ ...f, label: e.target.value }))}
              size="sm"
            />
          ) : (
            <span className="text-text-primary font-medium">{item.label}</span>
          ),
      },
      {
        key: "value",
        header: "Value",
        cell: (item) =>
          editingId === item.id ? (
            <Input
              value={editForm.value}
              onChange={(e) => setEditForm((f) => ({ ...f, value: e.target.value }))}
              size="sm"
            />
          ) : (
            <span className="text-text-secondary font-mono text-xs">{item.value}</span>
          ),
      },
    ];

    if (categoryDef.hasZone) {
      cols.push({
        key: "zoneSet",
        header: "Zone Set",
        cell: (item) => (
          <Badge variant={ZONE_BADGE_VARIANT[item.zoneSet] ?? "default"}>
            {item.zoneSet.replace("_", " ")}
          </Badge>
        ),
      });
    }

    cols.push(
      {
        key: "sortOrder",
        header: "Order",
        cell: (item) => <span className="text-text-muted">{item.sortOrder}</span>,
      },
      {
        key: "status",
        header: "Status",
        cell: (item) => (
          <button
            onClick={() => void toggleActive(item)}
            className={cn(
              "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors",
              item.isActive ? "bg-success-500" : "bg-bg-muted",
            )}
          >
            <span
              className={cn(
                "pointer-events-none mt-0.5 inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform",
                item.isActive ? "translate-x-[18px]" : "translate-x-0.5",
              )}
            />
          </button>
        ),
      },
      {
        key: "actions",
        header: "Actions",
        cell: (item) => {
          const idx = sortedItems.findIndex((i) => i.id === item.id);
          return (
            <div className="flex items-center gap-1">
              {editingId === item.id ? (
                <>
                  <Tooltip content="Save">
                    <IconButton
                      icon={Check}
                      aria-label="Save"
                      variant="success"
                      size="xs"
                      onClick={() => void handleEdit(item.id)}
                    />
                  </Tooltip>
                  <Tooltip content="Cancel">
                    <IconButton
                      icon={X}
                      aria-label="Cancel"
                      size="xs"
                      onClick={() => setEditingId(null)}
                    />
                  </Tooltip>
                </>
              ) : (
                <>
                  <Tooltip content="Edit">
                    <IconButton
                      icon={Pencil}
                      aria-label="Edit"
                      size="xs"
                      onClick={() => startEdit(item)}
                    />
                  </Tooltip>
                  <Tooltip content="Move up">
                    <IconButton
                      icon={ChevronUp}
                      aria-label="Move up"
                      size="xs"
                      disabled={idx === 0}
                      onClick={() => void moveItem(item, "up")}
                    />
                  </Tooltip>
                  <Tooltip content="Move down">
                    <IconButton
                      icon={ChevronDown}
                      aria-label="Move down"
                      size="xs"
                      disabled={idx === sortedItems.length - 1}
                      onClick={() => void moveItem(item, "down")}
                    />
                  </Tooltip>
                </>
              )}
            </div>
          );
        },
      },
    );

    return cols;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryDef.hasZone, editingId, editForm, sortedItems]);

  return (
    <div className="space-y-4">
      <PageHeader title="Master Data / Dropdown Options" />

      <div className="flex gap-6">
        {/* Category sidebar */}
        <nav className="w-52 shrink-0">
          <Tabs
            tabs={CATEGORY_TABS}
            activeTab={activeCategory}
            onChange={setActiveCategory}
            variant="pills"
            className="flex-col"
          />
        </nav>

        {/* Content */}
        <div className="flex-1 space-y-4">
          {/* Zone tabs for zone-dependent categories */}
          {categoryDef.hasZone && (
            <Tabs
              tabs={ZONE_TABS}
              activeTab={zoneFilter}
              onChange={setZoneFilter}
              variant="underline"
            />
          )}

          {/* Add button */}
          <div className="flex justify-end">
            <Button
              leftIcon={Plus}
              onClick={() => {
                setShowAdd(true);
                setAddForm({
                  label: "",
                  value: "",
                  zoneSet: zoneFilter !== "ALL" ? zoneFilter : "ALL",
                });
              }}
            >
              Add Option
            </Button>
          </div>

          {/* Add modal */}
          <Modal
            open={showAdd}
            onClose={() => setShowAdd(false)}
            title="Add New Option"
            size="md"
            footer={
              <>
                <Button variant="outline" onClick={() => setShowAdd(false)}>
                  Cancel
                </Button>
                <Button variant="success" onClick={() => void handleAdd()}>
                  Add
                </Button>
              </>
            }
          >
            <div className="space-y-4">
              <FormField label="Label" required htmlFor="add-label">
                <Input
                  id="add-label"
                  placeholder="Label"
                  value={addForm.label}
                  onChange={(e) => setAddForm((f) => ({ ...f, label: e.target.value }))}
                />
              </FormField>
              <FormField label="Value" required htmlFor="add-value">
                <Input
                  id="add-value"
                  placeholder="Value"
                  value={addForm.value}
                  onChange={(e) => setAddForm((f) => ({ ...f, value: e.target.value }))}
                />
              </FormField>
              {categoryDef.hasZone && (
                <FormField label="Zone Set" htmlFor="add-zone">
                  <Select
                    id="add-zone"
                    options={ZONE_OPTIONS}
                    value={addForm.zoneSet}
                    onChange={(e) => setAddForm((f) => ({ ...f, zoneSet: e.target.value }))}
                  />
                </FormField>
              )}
            </div>
          </Modal>

          {/* Options table */}
          <DataTable<DropdownItem>
            columns={columns}
            data={sortedItems}
            loading={isLoading}
            emptyIcon={List}
            emptyTitle="No options yet"
            emptyDescription={`Add options for ${categoryDef.label}`}
            getRowId={(row) => row.id}
            compact
          />
        </div>
      </div>
    </div>
  );
}
