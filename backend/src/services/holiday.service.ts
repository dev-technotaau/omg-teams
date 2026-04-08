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
      if (!year) {
        return prisma.holiday.findMany({
          orderBy: { date: "asc" },
          include: { creator: { select: { firstName: true, lastName: true } } },
        });
      }
      // For a specific year: include rows whose date falls in that year,
      // PLUS recurring rows from any prior year (projected onto this year).
      const start = new Date(`${year}-01-01`);
      const end = new Date(`${year + 1}-01-01`);
      const [inYear, recurringPrior] = await Promise.all([
        prisma.holiday.findMany({
          where: { date: { gte: start, lt: end } },
          include: { creator: { select: { firstName: true, lastName: true } } },
        }),
        prisma.holiday.findMany({
          where: { isRecurring: true, date: { lt: start } },
          include: { creator: { select: { firstName: true, lastName: true } } },
        }),
      ]);
      // De-dupe: if a recurring holiday's projection lands on a date that
      // already exists in `inYear`, prefer the in-year row.
      const inYearKeys = new Set(
        inYear.map((h) => `${h.date.getUTCMonth()}-${h.date.getUTCDate()}`),
      );
      const projected = recurringPrior
        .filter((h) => !inYearKeys.has(`${h.date.getUTCMonth()}-${h.date.getUTCDate()}`))
        .map((h) => ({
          ...h,
          date: new Date(Date.UTC(year, h.date.getUTCMonth(), h.date.getUTCDate())),
        }));
      return [...inYear, ...projected].sort((a, b) => a.date.getTime() - b.date.getTime());
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
      // Exact-date match (one-off or this year's instance of a recurring)
      const exact = await prisma.holiday.count({
        where: { date: { gte: startOfDay, lte: endOfDay } },
      });
      if (exact > 0) return true;
      // Recurring match: any prior-year recurring holiday whose month+day
      // matches this date. Postgres EXTRACT via raw query — Prisma can't
      // express month/day equality on a Date column otherwise.
      const month = date.getUTCMonth() + 1;
      const day = date.getUTCDate();
      const rows = await prisma.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*)::bigint AS count
        FROM "Holiday"
        WHERE "isRecurring" = true
          AND EXTRACT(MONTH FROM "date") = ${month}
          AND EXTRACT(DAY FROM "date") = ${day}
      `;
      return Number(rows[0]?.count ?? 0) > 0;
    },
    86400,
  );
}
