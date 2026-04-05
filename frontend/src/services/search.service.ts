import { api } from "@/lib/api";

export interface SearchResult {
  type: string;
  id: string;
  title: string;
  subtitle: string | null;
  url: string;
}

export interface SearchResponse {
  results: Record<string, SearchResult[]>;
  totalCount: number;
}

export async function globalSearch(
  query: string,
  types?: string[],
  limit?: number,
): Promise<SearchResponse> {
  const params: Record<string, string> = { q: query };
  if (types) params["types"] = types.join(",");
  if (limit) params["limit"] = String(limit);
  const res = await api.get<SearchResponse>("/search", { params });
  return res.data;
}
