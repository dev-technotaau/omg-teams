import { api } from "@/lib/api";

export interface Holiday {
  id: string;
  date: string;
  name: string;
  type: string;
  isRecurring: boolean;
  creator?: { firstName: string; lastName: string } | null;
}

export async function listHolidays(year?: number) {
  const params: Record<string, string> = {};
  if (year) params["year"] = String(year);
  const res = await api.get<{ data: Holiday[] }>("/holidays", { params });
  return res.data.data;
}

export async function createHoliday(data: {
  date: string;
  name: string;
  type?: string;
  isRecurring?: boolean;
}) {
  const res = await api.post<{ data: Holiday }>("/holidays", data);
  return res.data.data;
}

export async function updateHoliday(
  id: string,
  data: Partial<{ date: string; name: string; type: string; isRecurring: boolean }>,
) {
  const res = await api.patch<{ data: Holiday }>(`/holidays/${id}`, data);
  return res.data.data;
}

export async function deleteHoliday(id: string) {
  await api.delete(`/holidays/${id}`);
}
