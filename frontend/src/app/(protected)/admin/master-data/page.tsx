"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { qk } from "@/lib/query-keys";
import { Plus, GripVertical, Pencil, ChevronUp, ChevronDown, X, Check, List } from "lucide-react";
import { toast } from "sonner";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { restrictToVerticalAxis, restrictToParentElement } from "@dnd-kit/modifiers";
import { api, extractApiError } from "@/lib/api";
import {
  PageHeader,
  Tabs,
  Badge,
  Button,
  IconButton,
  Tooltip,
  Modal,
  FormField,
  Input,
  Select,
  TableSkeleton,
} from "@/components/ui";
import { cn } from "@/lib/utils";
import { useTabSearchParam } from "@/hooks";

// HRFeedback and PaymentStatus are hardcoded Prisma enums on CandidateReport,
// not rows in the dropdown_options table — they're not admin-configurable, so
// they don't appear here.
const CATEGORY_KEYS = [
  "state",
  "location",
  "profile",
  "higher_qualification",
  "notice_period",
  "diploma_type",
] as const;
type CategoryKey = (typeof CATEGORY_KEYS)[number];

// ──────────────────────────────────────────────
//  Master Data / Dropdown Options — Spec Section 23.19
//
//  - State rows carry a geographic `zone`. Admin sets it once per state.
//  - Location rows reference their parent State row via `parentId`. The
//    candidate form filters states by zone, then locations by selected
//    state, so the cascading dropdown is implicit. There is NO per-row
//    SET_A/SET_B tagging here anymore — it was the wrong abstraction.
//  - Profile, Higher Qualification, Notice Period, Diploma Type are flat.
// ──────────────────────────────────────────────

type Zone = "NORTH" | "SOUTH" | "EAST" | "WEST" | "CENTRAL";

interface DropdownItem {
  id: string;
  label: string;
  value: string;
  category: string;
  zone: Zone | null;
  parentId: string | null;
  sortOrder: number;
  isActive: boolean;
}

const CATEGORIES: Readonly<{ key: CategoryKey; label: string }[]> = [
  { key: "state", label: "State" },
  { key: "location", label: "Location" },
  { key: "profile", label: "Profile" },
  { key: "higher_qualification", label: "Higher Qualification" },
  { key: "notice_period", label: "Notice Period" },
  { key: "diploma_type", label: "Diploma Type" },
];

const CATEGORY_TABS = CATEGORIES.map((c) => ({ id: c.key, label: c.label }));

const ZONES: { value: Zone; label: string }[] = [
  { value: "NORTH", label: "North" },
  { value: "SOUTH", label: "South" },
  { value: "EAST", label: "East" },
  { value: "WEST", label: "West" },
  { value: "CENTRAL", label: "Central" },
];

const ZONE_BADGE_VARIANT: Record<Zone, "default" | "primary" | "info" | "success" | "warning"> = {
  NORTH: "info",
  SOUTH: "success",
  EAST: "warning",
  WEST: "primary",
  CENTRAL: "default",
};

interface AddFormState {
  label: string;
  value: string;
  zone: Zone | "";
  parentId: string;
}

const EMPTY_ADD: AddFormState = { label: "", value: "", zone: "", parentId: "" };

interface EditFormState {
  label: string;
  value: string;
  zone: Zone | "";
  parentId: string;
}

// ── Sortable row wrapper — each row is draggable via the grip handle ──
function SortableRow({
  id,
  children,
  disabled,
}: {
  id: string;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    position: isDragging ? "relative" : undefined,
    opacity: isDragging ? 0.85 : undefined,
  };

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={cn(
        "border-border-default border-b text-sm transition-colors last:border-b-0",
        "hover:bg-bg-hover",
        isDragging && "bg-bg-surface-raised shadow-lg",
      )}
    >
      {/* Drag handle cell */}
      <td className="w-10 px-2 py-2 text-center">
        <button
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          className="text-text-muted hover:text-text-primary cursor-grab touch-none rounded p-0.5 active:cursor-grabbing"
          aria-label="Drag to reorder"
          type="button"
        >
          <GripVertical size={14} />
        </button>
      </td>
      {children}
    </tr>
  );
}

export default function MasterDataPage() {
  const [activeCategory, setActiveCategory] = useTabSearchParam<CategoryKey>(
    "category",
    "state",
    CATEGORY_KEYS,
  );
  const qc = useQueryClient();
  /** All states, kept around independently of `activeCategory` so the
   *  Location tab can render parent-state names + populate its picker. */
  const [allStates, setAllStates] = useState<DropdownItem[]>([]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditFormState>({
    label: "",
    value: "",
    zone: "",
    parentId: "",
  });

  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState<AddFormState>(EMPTY_ADD);

  const isStateTab = activeCategory === "state";
  const isLocationTab = activeCategory === "location";

  // Server state — current category's items as a TanStack query, keyed by
  // category so each tab caches independently and switching is instant.
  const itemsQuery = useQuery({
    queryKey: qk.masterData.list(activeCategory),
    queryFn: async () => {
      const res = await api.get<{ data: DropdownItem[] }>(`/dropdowns/${activeCategory}`);
      return res.data.data ?? [];
    },
  });
  const items = useMemo(() => itemsQuery.data ?? [], [itemsQuery.data]);
  const isLoading = itemsQuery.isLoading;

  // Compatibility facade — call sites still call `void fetchItems()` after
  // mutations; we just invalidate the current category's cache.
  const fetchItems = useCallback(
    () => qc.invalidateQueries({ queryKey: qk.masterData.list(activeCategory) }),
    [qc, activeCategory],
  );

  // Independent state list — needed by the Location tab even when the
  // current category isn't State. Cached separately under masterData.list("state").
  const statesQuery = useQuery({
    queryKey: qk.masterData.list("state"),
    queryFn: async () => {
      const res = await api.get<{ data: DropdownItem[] }>(`/dropdowns/state`);
      return res.data.data ?? [];
    },
  });
  useEffect(() => {
    if (statesQuery.data) setAllStates(statesQuery.data);
  }, [statesQuery.data]);
  const fetchAllStates = useCallback(
    () => qc.invalidateQueries({ queryKey: qk.masterData.list("state") }),
    [qc],
  );

  // When the State tab is the active one, items === states; mirror them
  // into allStates so a freshly added/edited state shows up in the Location
  // tab's parent picker without a second roundtrip.
  useEffect(() => {
    if (isStateTab) setAllStates(items);
  }, [isStateTab, items]);

  useEffect(() => {
    setEditingId(null);
    setShowAdd(false);
  }, [activeCategory]);

  const stateById = useMemo(() => {
    const m = new Map<string, DropdownItem>();
    for (const s of allStates) m.set(s.id, s);
    return m;
  }, [allStates]);

  const stateOptions = useMemo(
    () => [
      { value: "", label: "— Select state —" },
      ...allStates
        .filter((s) => s.isActive)
        .map((s) => ({ value: s.id, label: s.label })),
    ],
    [allStates],
  );

  const sortedItems = useMemo(
    () => [...items].sort((a, b) => a.sortOrder - b.sortOrder),
    [items],
  );

  const handleAdd = async () => {
    if (!addForm.label.trim() || !addForm.value.trim()) {
      toast.error("Label and value are required");
      return;
    }
    if (isStateTab && !addForm.zone) {
      toast.error("Zone is required for states");
      return;
    }
    if (isLocationTab && !addForm.parentId) {
      toast.error("Parent state is required for locations");
      return;
    }
    try {
      await api.post("/dropdowns", {
        fieldKey: activeCategory,
        label: addForm.label,
        value: addForm.value,
        zone: isStateTab ? addForm.zone : null,
        parentId: isLocationTab ? addForm.parentId : null,
      });
      toast.success("Option added");
      setShowAdd(false);
      setAddForm(EMPTY_ADD);
      void fetchItems();
      if (isStateTab) void fetchAllStates();
    } catch (err) {
      toast.error(extractApiError(err).message);
    }
  };

  const handleEdit = async (id: string) => {
    if (!editForm.label.trim() || !editForm.value.trim()) {
      toast.error("Label and value are required");
      return;
    }
    if (isStateTab && !editForm.zone) {
      toast.error("Zone is required for states");
      return;
    }
    if (isLocationTab && !editForm.parentId) {
      toast.error("Parent state is required for locations");
      return;
    }
    try {
      await api.patch(`/dropdowns/${id}`, {
        label: editForm.label,
        value: editForm.value,
        ...(isStateTab && { zone: editForm.zone }),
        ...(isLocationTab && { parentId: editForm.parentId }),
      });
      toast.success("Option updated");
      setEditingId(null);
      void fetchItems();
      if (isStateTab) void fetchAllStates();
    } catch (err) {
      toast.error(extractApiError(err).message);
    }
  };

  const toggleActive = async (item: DropdownItem) => {
    try {
      await api.patch(`/dropdowns/${item.id}`, { isActive: !item.isActive });
      toast.success(item.isActive ? "Option deactivated" : "Option activated");
      void fetchItems();
      if (isStateTab) void fetchAllStates();
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
    setEditForm({
      label: item.label,
      value: item.value,
      zone: (item.zone ?? "") as Zone | "",
      parentId: item.parentId ?? "",
    });
  };

  // ── DnD sensors — pointer (mouse), touch, keyboard ──
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIdx = sortedItems.findIndex((i) => i.id === active.id);
      const newIdx = sortedItems.findIndex((i) => i.id === over.id);
      if (oldIdx === -1 || newIdx === -1) return;

      // Build new sort order assignments: move item from oldIdx to newIdx
      const reordered = [...sortedItems];
      const [moved] = reordered.splice(oldIdx, 1);
      reordered.splice(newIdx, 0, moved!);

      // Assign sequential sort orders
      const payload = reordered.map((item, i) => ({ id: item.id, sortOrder: i }));

      try {
        await api.post("/dropdowns/reorder", { items: payload });
        void fetchItems();
      } catch (err) {
        toast.error(extractApiError(err).message);
      }
    },
    [sortedItems, fetchItems],
  );

  const sortableIds = useMemo(() => sortedItems.map((i) => i.id), [sortedItems]);

  const activeLabel = CATEGORIES.find((c) => c.key === activeCategory)?.label ?? "";

  return (
    <div className="space-y-4">
      <PageHeader title="Master Data / Dropdown Options" />

      <div className="flex gap-6">
        {/* Category sidebar */}
        <nav className="w-52 shrink-0">
          <Tabs
            tabs={CATEGORY_TABS}
            activeTab={activeCategory}
            onChange={(id) => setActiveCategory(id as CategoryKey)}
            variant="pills"
            className="flex-col items-stretch gap-2"
          />
        </nav>

        {/* Content */}
        <div className="flex-1 space-y-4">
          {/* Add button */}
          <div className="flex justify-end">
            <Button
              leftIcon={Plus}
              onClick={() => {
                setShowAdd(true);
                setAddForm(EMPTY_ADD);
              }}
            >
              Add Option
            </Button>
          </div>

          {/* Add modal */}
          <Modal
            open={showAdd}
            onClose={() => setShowAdd(false)}
            title={`Add New ${activeLabel}`}
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
              {isStateTab && (
                <FormField label="Zone" required htmlFor="add-zone">
                  <Select
                    id="add-zone"
                    options={[{ value: "", label: "— Select zone —" }, ...ZONES]}
                    value={addForm.zone}
                    onChange={(e) =>
                      setAddForm((f) => ({ ...f, zone: e.target.value as Zone | "" }))
                    }
                  />
                </FormField>
              )}
              {isLocationTab && (
                <FormField label="State" required htmlFor="add-parent">
                  <Select
                    id="add-parent"
                    options={stateOptions}
                    value={addForm.parentId}
                    onChange={(e) => setAddForm((f) => ({ ...f, parentId: e.target.value }))}
                  />
                </FormField>
              )}
            </div>
          </Modal>

          {/* Options table — DnD sortable */}
          {isLoading ? (
            <TableSkeleton />
          ) : sortedItems.length === 0 ? (
            <div className="border-border-default flex flex-col items-center justify-center rounded-lg border py-12">
              <List size={32} className="text-text-muted mb-2" />
              <p className="text-text-primary text-sm font-medium">No options yet</p>
              <p className="text-text-muted text-xs">Add options for {activeLabel}</p>
            </div>
          ) : (
            <div className="border-border-default overflow-x-auto rounded-lg border">
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                modifiers={[restrictToVerticalAxis, restrictToParentElement]}
                onDragEnd={(e) => void handleDragEnd(e)}
              >
                <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="border-border-default bg-bg-muted/50 border-b">
                        <th className="w-10 px-2 py-2" />
                        <th className="px-3 py-2 text-left text-xs font-medium">Label</th>
                        <th className="px-3 py-2 text-left text-xs font-medium">Value</th>
                        {isStateTab && <th className="px-3 py-2 text-left text-xs font-medium">Zone</th>}
                        {isLocationTab && <th className="px-3 py-2 text-left text-xs font-medium">State</th>}
                        <th className="px-3 py-2 text-left text-xs font-medium">Order</th>
                        <th className="px-3 py-2 text-left text-xs font-medium">Status</th>
                        <th className="px-3 py-2 text-left text-xs font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedItems.map((item) => {
                        const idx = sortedItems.indexOf(item);
                        const isEditing = editingId === item.id;
                        return (
                          <SortableRow key={item.id} id={item.id} disabled={isEditing}>
                            {/* Label */}
                            <td className="px-3 py-2">
                              {isEditing ? (
                                <Input
                                  value={editForm.label}
                                  onChange={(e) => setEditForm((f) => ({ ...f, label: e.target.value }))}
                                  size="sm"
                                />
                              ) : (
                                <span className="text-text-primary font-medium">{item.label}</span>
                              )}
                            </td>
                            {/* Value */}
                            <td className="px-3 py-2">
                              {isEditing ? (
                                <Input
                                  value={editForm.value}
                                  onChange={(e) => setEditForm((f) => ({ ...f, value: e.target.value }))}
                                  size="sm"
                                />
                              ) : (
                                <span className="text-text-secondary font-mono text-xs">{item.value}</span>
                              )}
                            </td>
                            {/* Zone (state tab only) */}
                            {isStateTab && (
                              <td className="px-3 py-2">
                                {isEditing ? (
                                  <Select
                                    size="sm"
                                    value={editForm.zone}
                                    onChange={(e) => setEditForm((f) => ({ ...f, zone: e.target.value as Zone | "" }))}
                                    options={[{ value: "", label: "— Select zone —" }, ...ZONES]}
                                  />
                                ) : item.zone ? (
                                  <Badge variant={ZONE_BADGE_VARIANT[item.zone]}>{item.zone}</Badge>
                                ) : (
                                  <span className="text-text-muted text-xs italic">unset</span>
                                )}
                              </td>
                            )}
                            {/* Parent state (location tab only) */}
                            {isLocationTab && (
                              <td className="px-3 py-2">
                                {isEditing ? (
                                  <Select
                                    size="sm"
                                    value={editForm.parentId}
                                    onChange={(e) => setEditForm((f) => ({ ...f, parentId: e.target.value }))}
                                    options={stateOptions}
                                  />
                                ) : (() => {
                                  const parent = item.parentId ? stateById.get(item.parentId) : null;
                                  return parent ? (
                                    <span className="text-text-primary text-sm">{parent.label}</span>
                                  ) : (
                                    <span className="text-text-muted text-xs italic">unset</span>
                                  );
                                })()}
                              </td>
                            )}
                            {/* Sort order */}
                            <td className="px-3 py-2">
                              <span className="text-text-muted">{item.sortOrder}</span>
                            </td>
                            {/* Status toggle */}
                            <td className="px-3 py-2">
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
                            </td>
                            {/* Actions */}
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-1">
                                {isEditing ? (
                                  <>
                                    <Tooltip content="Save">
                                      <IconButton icon={Check} aria-label="Save" variant="success" size="xs" onClick={() => void handleEdit(item.id)} />
                                    </Tooltip>
                                    <Tooltip content="Cancel">
                                      <IconButton icon={X} aria-label="Cancel" size="xs" onClick={() => setEditingId(null)} />
                                    </Tooltip>
                                  </>
                                ) : (
                                  <>
                                    <Tooltip content="Edit">
                                      <IconButton icon={Pencil} aria-label="Edit" size="xs" onClick={() => startEdit(item)} />
                                    </Tooltip>
                                    <Tooltip content="Move up">
                                      <IconButton icon={ChevronUp} aria-label="Move up" size="xs" disabled={idx === 0} onClick={() => void moveItem(item, "up")} />
                                    </Tooltip>
                                    <Tooltip content="Move down">
                                      <IconButton icon={ChevronDown} aria-label="Move down" size="xs" disabled={idx === sortedItems.length - 1} onClick={() => void moveItem(item, "down")} />
                                    </Tooltip>
                                  </>
                                )}
                              </div>
                            </td>
                          </SortableRow>
                        );
                      })}
                    </tbody>
                  </table>
                </SortableContext>
              </DndContext>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
