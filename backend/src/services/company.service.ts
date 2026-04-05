import { getPrisma } from "../config/database.js";
import { ConflictError } from "../exceptions/conflict-error.js";
import { NotFoundError } from "../exceptions/not-found-error.js";

// ──────────────────────────────────────────────
//  Company / Service Provider / HR Manager Service
//  Spec Section 9
// ──────────────────────────────────────────────

// ── Company ──

export async function createCompany(name: string) {
  const prisma = getPrisma();
  const existing = await prisma.company.findFirst({ where: { name, deletedAt: null } });
  if (existing) throw new ConflictError(`Company "${name}" already exists`);
  return prisma.company.create({ data: { name } });
}

export async function listCompanies(search?: string) {
  const prisma = getPrisma();
  return prisma.company.findMany({
    where: {
      deletedAt: null,
      ...(search && { name: { contains: search, mode: "insensitive" as const } }),
    },
    include: {
      serviceProviders: { where: { deletedAt: null }, select: { id: true, name: true } },
      hrManagers: {
        where: { deletedAt: null },
        select: { id: true, name: true, email: true, phone: true },
      },
      _count: { select: { candidateReports: true } },
    },
    orderBy: { name: "asc" },
  });
}

export async function getCompanyById(id: string) {
  const prisma = getPrisma();
  const company = await prisma.company.findFirst({
    where: { id, deletedAt: null },
    include: {
      serviceProviders: { where: { deletedAt: null } },
      hrManagers: { where: { deletedAt: null } },
    },
  });
  if (!company) throw new NotFoundError("Company", id);
  return company;
}

export async function updateCompany(id: string, name: string) {
  const prisma = getPrisma();
  return prisma.company.update({ where: { id }, data: { name } });
}

export async function deleteCompany(id: string, deletedBy: string) {
  const prisma = getPrisma();
  return prisma.company.update({
    where: { id },
    data: { deletedAt: new Date(), deletedBy },
  });
}

// ── Service Provider ──

export async function createServiceProvider(name: string, companyId: string) {
  const prisma = getPrisma();
  await getCompanyById(companyId); // verify company exists
  return prisma.serviceProvider.create({ data: { name, companyId } });
}

export async function listServiceProvidersByCompany(companyId: string) {
  const prisma = getPrisma();
  return prisma.serviceProvider.findMany({
    where: { companyId, deletedAt: null },
    orderBy: { name: "asc" },
  });
}

export async function updateServiceProvider(id: string, name: string) {
  const prisma = getPrisma();
  return prisma.serviceProvider.update({ where: { id }, data: { name } });
}

export async function deleteServiceProvider(id: string, deletedBy: string) {
  const prisma = getPrisma();
  return prisma.serviceProvider.update({
    where: { id },
    data: { deletedAt: new Date(), deletedBy },
  });
}

// ── HR Manager ──

export async function createHRManager(data: {
  name: string;
  companyId: string;
  email?: string | null | undefined;
  phone?: string | null | undefined;
}) {
  const prisma = getPrisma();
  await getCompanyById(data.companyId); // verify company exists
  return prisma.hRManager.create({
    data: {
      name: data.name,
      companyId: data.companyId,
      email: data.email ?? null,
      phone: data.phone ?? null,
    },
  });
}

export async function listHRManagersByCompany(companyId: string) {
  const prisma = getPrisma();
  return prisma.hRManager.findMany({
    where: { companyId, deletedAt: null },
    orderBy: { name: "asc" },
  });
}

export async function updateHRManager(
  id: string,
  data: {
    name?: string | undefined;
    email?: string | null | undefined;
    phone?: string | null | undefined;
  },
) {
  const prisma = getPrisma();
  const updateData: Record<string, unknown> = {};
  if (data.name !== undefined) updateData["name"] = data.name;
  if (data.email !== undefined) updateData["email"] = data.email ?? null;
  if (data.phone !== undefined) updateData["phone"] = data.phone ?? null;
  return prisma.hRManager.update({ where: { id }, data: updateData });
}

export async function deleteHRManager(id: string, deletedBy: string) {
  const prisma = getPrisma();
  return prisma.hRManager.update({
    where: { id },
    data: { deletedAt: new Date(), deletedBy },
  });
}
