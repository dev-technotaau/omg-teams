import { api } from "@/lib/api";

export interface DropdownOption {
  id: string;
  category: string;
  value: string;
  label: string;
  zoneSet: string | null;
  sortOrder: number;
}

export async function getDropdownOptions(
  category: string,
  zoneSet?: string,
): Promise<DropdownOption[]> {
  const params: Record<string, string> = {};
  if (zoneSet) params["zoneSet"] = zoneSet;
  const res = await api.get<{ options: DropdownOption[] }>(`/dropdowns/${category}`, { params });
  return res.data.options;
}
