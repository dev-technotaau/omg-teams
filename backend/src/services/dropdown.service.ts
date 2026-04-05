import { type DropdownCategory, type ZoneSet } from "@prisma/client";
import { cache } from "../config/cache.js";
import { getPrisma } from "../config/database.js";

// ──────────────────────────────────────────────
//  Dropdown Options Service (Admin Master Data)
//  Spec Section 23.19
// ──────────────────────────────────────────────

export async function listDropdownOptions(category: DropdownCategory, zoneSet?: ZoneSet | null) {
  const cacheKey = `dropdown:list:${category}:${zoneSet ?? "none"}`;
  return cache.getOrSet(
    cacheKey,
    async () => {
      const prisma = getPrisma();
      return prisma.dropdownOption.findMany({
        where: {
          category,
          isActive: true,
          ...(zoneSet && { OR: [{ zoneSet }, { zoneSet: "ALL" }, { zoneSet: null }] }),
        },
        orderBy: { sortOrder: "asc" },
      });
    },
    86400,
  );
}

export async function createDropdownOption(data: {
  category: DropdownCategory;
  value: string;
  label: string;
  zoneSet?: ZoneSet | null | undefined;
  sortOrder?: number | undefined;
}) {
  const prisma = getPrisma();
  const result = await prisma.dropdownOption.create({
    data: {
      category: data.category,
      value: data.value,
      label: data.label,
      zoneSet: data.zoneSet ?? null,
      sortOrder: data.sortOrder ?? 0,
    },
  });
  await cache.delPattern(`dropdown:list:${data.category}:*`);
  return result;
}

export async function updateDropdownOption(
  id: string,
  data: {
    value?: string | undefined;
    label?: string | undefined;
    zoneSet?: ZoneSet | null | undefined;
    sortOrder?: number | undefined;
    isActive?: boolean | undefined;
  },
) {
  const prisma = getPrisma();
  const updateData: Record<string, unknown> = {};
  if (data.value !== undefined) updateData["value"] = data.value;
  if (data.label !== undefined) updateData["label"] = data.label;
  if (data.zoneSet !== undefined) updateData["zoneSet"] = data.zoneSet ?? null;
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

export async function reorderDropdownOptions(ids: string[]) {
  const prisma = getPrisma();
  const updates = ids.map((id, index) =>
    prisma.dropdownOption.update({ where: { id }, data: { sortOrder: index } }),
  );
  await prisma.$transaction(updates);
  await cache.delPattern("dropdown:list:*");
}
