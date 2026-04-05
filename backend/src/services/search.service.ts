import { type Role } from "@prisma/client";
import { getPrisma } from "../config/database.js";

// ──────────────────────────────────────────────
//  Global Search Service — Spec Section 23.10
// ──────────────────────────────────────────────

interface SearchResult {
  type: string;
  id: string;
  title: string;
  subtitle: string | null;
  url: string;
}

interface SearchResponse {
  results: Record<string, SearchResult[]>;
  totalCount: number;
}

export async function globalSearch(
  query: string,
  userId: string,
  role: Role,
  options?: { types?: string[]; limit?: number },
): Promise<SearchResponse> {
  const prisma = getPrisma();
  const limit = options?.limit ?? 5;
  const results: Record<string, SearchResult[]> = {};
  let totalCount = 0;

  const shouldSearch = (type: string) => !options?.types || options.types.includes(type);

  // Candidates — all roles can search, scoped by access
  if (shouldSearch("candidates")) {
    const where: Record<string, unknown> = {
      deletedAt: null,
      OR: [
        { candidateName: { contains: query, mode: "insensitive" } },
        { contactNo: { contains: query, mode: "insensitive" } },
        { emailId: { contains: query, mode: "insensitive" } },
      ],
    };

    if (role === "RECRUITER") {
      where["recruiterId"] = userId;
    } else if (role === "REPORTING_MANAGER") {
      // RM sees only assigned recruiters' data
      const assignments = await prisma.recruiterManagerAssignment.findMany({
        where: { managerId: userId },
        select: { recruiterId: true },
      });
      where["recruiterId"] = { in: assignments.map((a) => a.recruiterId) };
    }

    const candidates = await prisma.candidateReport.findMany({
      where: where as never,
      take: limit,
      orderBy: { createdAt: "desc" },
      select: { id: true, candidateName: true, contactNo: true, emailId: true, zone: true },
    });

    if (candidates.length > 0) {
      results["candidates"] = candidates.map((c) => ({
        type: "candidate",
        id: c.id,
        title: c.candidateName ?? "Unnamed",
        subtitle: c.contactNo ?? c.emailId ?? null,
        url: `/admin/reports?search=${encodeURIComponent(query)}`,
      }));
      totalCount += candidates.length;
    }
  }

  // Companies — admin only
  if (role === "ADMIN" && shouldSearch("companies")) {
    const companies = await prisma.company.findMany({
      where: { deletedAt: null, name: { contains: query, mode: "insensitive" } },
      take: limit,
      select: { id: true, name: true },
    });
    if (companies.length > 0) {
      results["companies"] = companies.map((c) => ({
        type: "company",
        id: c.id,
        title: c.name,
        subtitle: null,
        url: `/admin/companies`,
      }));
      totalCount += companies.length;
    }
  }

  // Service Providers — admin only
  if (role === "ADMIN" && shouldSearch("serviceProviders")) {
    const sps = await prisma.serviceProvider.findMany({
      where: { deletedAt: null, name: { contains: query, mode: "insensitive" } },
      take: limit,
      select: { id: true, name: true, company: { select: { name: true } } },
    });
    if (sps.length > 0) {
      results["serviceProviders"] = sps.map((sp) => ({
        type: "serviceProvider",
        id: sp.id,
        title: sp.name,
        subtitle: sp.company.name,
        url: `/admin/companies`,
      }));
      totalCount += sps.length;
    }
  }

  // HR Managers — admin only
  if (role === "ADMIN" && shouldSearch("hrManagers")) {
    const hrs = await prisma.hRManager.findMany({
      where: { deletedAt: null, name: { contains: query, mode: "insensitive" } },
      take: limit,
      select: { id: true, name: true, email: true, company: { select: { name: true } } },
    });
    if (hrs.length > 0) {
      results["hrManagers"] = hrs.map((hr) => ({
        type: "hrManager",
        id: hr.id,
        title: hr.name,
        subtitle: hr.company.name,
        url: `/admin/companies`,
      }));
      totalCount += hrs.length;
    }
  }

  // Users — admin and RM
  if ((role === "ADMIN" || role === "REPORTING_MANAGER") && shouldSearch("users")) {
    const userWhere: Record<string, unknown> = {
      OR: [
        { firstName: { contains: query, mode: "insensitive" } },
        { lastName: { contains: query, mode: "insensitive" } },
        { email: { contains: query, mode: "insensitive" } },
        { employeeId: { contains: query, mode: "insensitive" } },
      ],
    };

    if (role === "REPORTING_MANAGER") {
      const assignments = await prisma.recruiterManagerAssignment.findMany({
        where: { managerId: userId },
        select: { recruiterId: true },
      });
      userWhere["id"] = { in: assignments.map((a) => a.recruiterId) };
    }

    const users = await prisma.user.findMany({
      where: userWhere as never,
      take: limit,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        employeeId: true,
        role: true,
      },
    });
    if (users.length > 0) {
      results["users"] = users.map((u) => ({
        type: "user",
        id: u.id,
        title: `${u.firstName} ${u.lastName}`,
        subtitle: u.employeeId ?? u.email,
        url: role === "ADMIN" ? `/admin/users` : `/my-recruiters`,
      }));
      totalCount += users.length;
    }
  }

  return { results, totalCount };
}
