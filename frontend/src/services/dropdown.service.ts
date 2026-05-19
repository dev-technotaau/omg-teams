import { api } from "@/lib/api";

// ──────────────────────────────────────────────
//  Dropdown Options client — used by candidate form, master-data page,
//  and any other surface that needs admin-configurable pick lists.
//
//  The backend response shape is `{ data: DropdownOption[] }`. Both the
//  uppercase Prisma enum (e.g. "STATE") and the lowercase friendly key
//  (e.g. "state") are accepted by the controller; existing call sites
//  pass UPPERCASE for back-compat.
// ──────────────────────────────────────────────

export type Zone = "NORTH" | "SOUTH" | "EAST" | "WEST" | "CENTRAL";

export interface DropdownOption {
  id: string;
  category: string;
  value: string;
  label: string;
  /** Geographic zone — populated only on STATE rows. */
  zone: Zone | null;
  /** Parent state's id — populated only on LOCATION rows. */
  parentId: string | null;
  sortOrder: number;
  isActive: boolean;
}

export async function getDropdownOptions(category: string): Promise<DropdownOption[]> {
  const res = await api.get<{ data: DropdownOption[] }>(`/dropdowns/${category}`);
  return res.data.data ?? [];
}

export interface CreateDropdownOptionInput {
  category: string;
  label: string;
  /** Defaults to lowercase(label) when omitted. */
  value?: string;
  /** Required for LOCATION rows — parent state's id. */
  parentId?: string | null;
  /** Required for STATE rows — geographic zone. */
  zone?: Zone | null;
}

/**
 * Create (or reactivate / return-existing) a dropdown option. Used by the
 * candidate form's "+ Add [value]" backfill affordance for Location and
 * Profile fields. Backend is idempotent — calling with a value that already
 * exists for the same (category, parentId) just returns the existing row.
 */
export async function createDropdownOption(
  input: CreateDropdownOptionInput,
): Promise<DropdownOption> {
  const value = (input.value ?? input.label).trim().toLowerCase();
  const res = await api.post<{ data: DropdownOption }>("/dropdowns", {
    category: input.category,
    value,
    label: input.label.trim(),
    parentId: input.parentId ?? null,
    zone: input.zone ?? null,
  });
  return res.data.data;
}
