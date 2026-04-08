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
