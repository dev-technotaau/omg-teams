import { cache } from "../config/cache.js";
import { getPrisma } from "../config/database.js";

// ──────────────────────────────────────────────
//  Holiday Calendar Service — Spec Section 27.9
// ──────────────────────────────────────────────

export async function listHolidays(year?: number) {
  const prisma = getPrisma();
  const cacheKey = `holidays:list:${year ?? "all"}`;
  return cache.getOrSet(
    cacheKey,
    async () => {
      const where: Record<string, unknown> = {};
      if (year) {
        const start = new Date(`${year}-01-01`);
        const end = new Date(`${year + 1}-01-01`);
        where["date"] = { gte: start, lt: end };
      }
      return prisma.holiday.findMany({
        where,
        orderBy: { date: "asc" },
        include: { creator: { select: { firstName: true, lastName: true } } },
      });
    },
    86400,
  );
}

export async function createHoliday(
  data: { date: string; name: string; type?: string; isRecurring?: boolean },
  createdBy: string,
) {
  const prisma = getPrisma();
  const result = await prisma.holiday.create({
    data: {
      date: new Date(data.date),
      name: data.name,
      type: data.type ?? "CUSTOM",
      isRecurring: data.isRecurring ?? false,
      createdBy,
    },
  });
  await cache.delPattern("holidays:*");
  return result;
}

export async function updateHoliday(
  id: string,
  data: { date?: string; name?: string; type?: string; isRecurring?: boolean },
) {
  const prisma = getPrisma();
  const updateData: Record<string, unknown> = {};
  if (data.date !== undefined) updateData["date"] = new Date(data.date);
  if (data.name !== undefined) updateData["name"] = data.name;
  if (data.type !== undefined) updateData["type"] = data.type;
  if (data.isRecurring !== undefined) updateData["isRecurring"] = data.isRecurring;
  const result = await prisma.holiday.update({ where: { id }, data: updateData });
  await cache.delPattern("holidays:*");
  return result;
}

export async function deleteHoliday(id: string) {
  const prisma = getPrisma();
  const result = await prisma.holiday.delete({ where: { id } });
  await cache.delPattern("holidays:*");
  return result;
}

export async function isHoliday(date: Date): Promise<boolean> {
  const dateStr = date.toISOString().slice(0, 10);
  const cacheKey = `holidays:isHoliday:${dateStr}`;
  return cache.getOrSet(
    cacheKey,
    async () => {
      const prisma = getPrisma();
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      const count = await prisma.holiday.count({
        where: { date: { gte: startOfDay, lte: endOfDay } },
      });
      return count > 0;
    },
    86400,
  );
}
