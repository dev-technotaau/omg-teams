import { api } from "@/lib/api";

export interface EmailTemplate {
  templateKey: string;
  subject: string;
  bodyHtml: string;
  isCustomized: boolean;
  updatedAt: string | null;
  updatedBy: string | null;
  id: string | null;
  variables?: string[];
}

export async function listTemplates() {
  const res = await api.get<{ data: EmailTemplate[] }>("/email-templates");
  return res.data.data;
}

export async function getTemplate(key: string) {
  const res = await api.get<{ data: EmailTemplate & { variables: string[] } }>(
    `/email-templates/${key}`,
  );
  return res.data.data;
}

export async function updateTemplate(key: string, data: { subject: string; bodyHtml: string }) {
  const res = await api.put<{ data: EmailTemplate }>(`/email-templates/${key}`, data);
  return res.data.data;
}

export async function resetTemplate(key: string) {
  const res = await api.delete<{ data: { subject: string; bodyHtml: string } }>(
    `/email-templates/${key}/reset`,
  );
  return res.data.data;
}

export async function previewTemplate(key: string, variables: Record<string, string>) {
  const res = await api.post<{ data: { subject: string; bodyHtml: string } }>(
    `/email-templates/${key}/preview`,
    { variables },
  );
  return res.data.data;
}
