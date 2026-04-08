import { type DropdownCategory, type Zone } from "@prisma/client";
import { cache } from "../config/cache.js";
import { getPrisma } from "../config/database.js";

// ──────────────────────────────────────────────
//  Dropdown Options Service (Admin Master Data)
//  Spec Section 23.19
// ──────────────────────────────────────────────

/**
 * Runtime list — used by candidate forms etc. Caches and only returns
 * options where `isActive: true`. The `zoneSet` filter is intentionally
 * gone: state/location/profile zoning is now expressed via per-row `zone`
 * (states) and `parentId` (locations); the form does the cascade itself.
 */
export async function listDropdownOptions(category: DropdownCategory) {
  const cacheKey = `dropdown:list:${category}`;
  return cache.getOrSet(
    cacheKey,
    async () => {
      const prisma = getPrisma();
      return prisma.dropdownOption.findMany({
        where: { category, isActive: true },
        orderBy: { sortOrder: "asc" },
      });
    },
    86400,
  );
}

/**
 * Admin master-data list — does NOT filter by `isActive` so deactivated
 * options remain visible (and re-activatable) in the management UI.
 * Uncached so admin sees changes immediately.
 */
export async function listDropdownOptionsAdmin(category: DropdownCategory, includeInactive = true) {
  const prisma = getPrisma();
  return prisma.dropdownOption.findMany({
    where: {
      category,
      ...(includeInactive ? {} : { isActive: true }),
    },
    orderBy: { sortOrder: "asc" },
  });
}

export async function createDropdownOption(data: {
  category: DropdownCategory;
  value: string;
  label: string;
  zone?: Zone | null | undefined;
  parentId?: string | null | undefined;
  sortOrder?: number | undefined;
}) {
  const prisma = getPrisma();
  const result = await prisma.dropdownOption.create({
    data: {
      category: data.category,
      value: data.value,
      label: data.label,
      zone: data.zone ?? null,
      parentId: data.parentId ?? null,
      sortOrder: data.sortOrder ?? 0,
    },
  });
  await cache.delPattern(`dropdown:list:${data.category}*`);
  return result;
}

export async function updateDropdownOption(
  id: string,
  data: {
    value?: string | undefined;
    label?: string | undefined;
    zone?: Zone | null | undefined;
    parentId?: string | null | undefined;
    sortOrder?: number | undefined;
    isActive?: boolean | undefined;
  },
) {
  const prisma = getPrisma();
  const updateData: Record<string, unknown> = {};
  if (data.value !== undefined) updateData["value"] = data.value;
  if (data.label !== undefined) updateData["label"] = data.label;
  if (data.zone !== undefined) updateData["zone"] = data.zone ?? null;
  if (data.parentId !== undefined) updateData["parentId"] = data.parentId ?? null;
  if (data.sortOrder !== undefined) updateData["sortOrder"] = data.sortOrder;
  if (data.isActive !== undefined) updateData["isActive"] = data.isActive;
  const result = await prisma.dropdownOption.update({ where: { id }, data: updateData });
  await cache.delPattern("dropdown:list:*");
  return result;
}

export async function deleteDropdownOption(id: string) {
  const prisma = getPrisma();
  const result = await prisma.dropdownOption.update({ where: { id }, data: { isActive: false } });
  await cache.delPattern("dropdown:list:*");
  return result;
}

/**
 * Apply explicit sort orders to a set of dropdown options.
 *
 * The admin master-data UI sends `[{ id, sortOrder }]` after a swap so we
 * can update only the rows that actually moved (move-up / move-down) without
 * renumbering the whole list. Wrapped in a transaction so partial failures
 * don't leave the ordering inconsistent.
 */
export async function reorderDropdownOptions(items: { id: string; sortOrder: number }[]) {
  const prisma = getPrisma();
  const updates = items.map((it) =>
    prisma.dropdownOption.update({ where: { id: it.id }, data: { sortOrder: it.sortOrder } }),
  );
  await prisma.$transaction(updates);
  await cache.delPattern("dropdown:list:*");
}
