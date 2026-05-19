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
  const rows = await prisma.dropdownOption.findMany({
    where: {
      category,
      ...(includeInactive ? {} : { isActive: true }),
    },
    orderBy: { sortOrder: "asc" },
  });

  // Auto-heal duplicate sortOrders left over from seeding — if any two rows
  // share the same sortOrder, reassign sequential values and persist them.
  const hasDupes = rows.length > 1 && rows.some((r, i) => i > 0 && r.sortOrder === rows[i - 1]!.sortOrder);
  if (hasDupes) {
    await Promise.all(
      rows.map((r, i) =>
        r.sortOrder !== i
          ? prisma.dropdownOption.update({ where: { id: r.id }, data: { sortOrder: i } })
          : Promise.resolve(),
      ),
    );
    for (let i = 0; i < rows.length; i++) rows[i]!.sortOrder = i;
    await cache.delPattern(`dropdown:list:${category}*`);
  }

  return rows;
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

  // Idempotent backfill: if a row already exists with the same (category,
  // value, parentId) — either active or inactive — return it instead of
  // crashing on the unique-constraint violation. Inactive rows are flipped
  // back to active so the option reappears in dropdowns. This makes the
  // form's "+ Add" affordance safe to spam without 500s.
  const normalizedValue = data.value.trim().toLowerCase();
  const existing = await prisma.dropdownOption.findFirst({
    where: {
      category: data.category,
      value: normalizedValue,
      // For locations, scope existence check to the same parent state so two
      // different states can have a same-named location (e.g. "central").
      ...(data.category === "LOCATION" ? { parentId: data.parentId ?? null } : {}),
    },
  });
  if (existing) {
    if (!existing.isActive) {
      const reactivated = await prisma.dropdownOption.update({
        where: { id: existing.id },
        data: { isActive: true },
      });
      await cache.delPattern(`dropdown:list:${data.category}*`);
      return reactivated;
    }
    return existing;
  }

  // Auto-assign sortOrder to end of list when not explicitly provided
  let sortOrder = data.sortOrder;
  if (sortOrder === undefined) {
    const last = await prisma.dropdownOption.findFirst({
      where: { category: data.category },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });
    sortOrder = (last?.sortOrder ?? -1) + 1;
  }
  const result = await prisma.dropdownOption.create({
    data: {
      category: data.category,
      value: normalizedValue,
      label: data.label.trim(),
      zone: data.zone ?? null,
      parentId: data.parentId ?? null,
      sortOrder,
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
