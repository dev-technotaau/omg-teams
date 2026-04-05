import { api } from "@/lib/api";
import type { Company } from "@/types/company";

export type { Company };

export async function listCompanies(search?: string): Promise<Company[]> {
  const params = search ? { search } : undefined;
  const res = await api.get<{ companies: Company[] }>("/companies", { params });
  return res.data.companies;
}

export async function createCompany(name: string): Promise<Company> {
  const res = await api.post<{ company: Company }>("/companies", { name });
  return res.data.company;
}

export async function updateCompany(id: string, name: string): Promise<void> {
  await api.patch(`/companies/${id}`, { name });
}

export async function deleteCompany(id: string): Promise<void> {
  await api.delete(`/companies/${id}`);
}

export async function createServiceProvider(name: string, companyId: string): Promise<void> {
  await api.post("/companies/service-providers", { name, companyId });
}

export async function createHRManager(data: {
  name: string;
  companyId: string;
  email?: string;
  phone?: string;
}): Promise<void> {
  await api.post("/companies/hr-managers", data);
}

export async function updateServiceProvider(id: string, data: { name: string }): Promise<void> {
  await api.patch(`/companies/service-providers/${id}`, data);
}

export async function deleteServiceProvider(id: string): Promise<void> {
  await api.delete(`/companies/service-providers/${id}`);
}

export async function updateHRManager(
  id: string,
  data: {
    name?: string;
    email?: string;
    phone?: string;
  },
): Promise<void> {
  await api.patch(`/companies/hr-managers/${id}`, data);
}

export async function deleteHRManager(id: string): Promise<void> {
  await api.delete(`/companies/hr-managers/${id}`);
}
