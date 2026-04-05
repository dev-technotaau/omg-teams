import { z } from "zod";
import * as etSvc from "../services/email-template.service.js";
import type { Request, Response } from "express";

const updateTemplateSchema = z.object({
  subject: z.string().min(1),
  bodyHtml: z.string().min(1),
});

const previewSchema = z.object({
  variables: z.record(z.string(), z.string()).optional(),
});

export async function handleListTemplates(_req: Request, res: Response): Promise<void> {
  const templates = await etSvc.listTemplates();
  res.status(200).json({ data: templates });
}

export async function handleGetTemplate(req: Request, res: Response): Promise<void> {
  const template = await etSvc.getTemplate(req.params["key"] as string);
  if (!template) {
    res.status(404).json({ error: "Template not found" });
    return;
  }
  const variables = etSvc.getAvailableVariables(req.params["key"] as string);
  res.status(200).json({ data: { ...template, variables } });
}

export async function handleUpdateTemplate(req: Request, res: Response): Promise<void> {
  const body = updateTemplateSchema.parse(req.body);
  const template = await etSvc.updateTemplate(req.params["key"] as string, body, req.user!.id);
  res.status(200).json({ data: template });
}

export async function handleResetTemplate(req: Request, res: Response): Promise<void> {
  const template = await etSvc.resetTemplate(req.params["key"] as string);
  res.status(200).json({ data: template, message: "Template reset to default" });
}

export async function handlePreviewTemplate(req: Request, res: Response): Promise<void> {
  const template = await etSvc.getTemplate(req.params["key"] as string);
  if (!template) {
    res.status(404).json({ error: "Template not found" });
    return;
  }
  const body = previewSchema.parse(req.body);
  const rendered = etSvc.renderTemplate(template, body.variables ?? {});
  res.status(200).json({ data: rendered });
}
