import { z } from "zod";
import * as olSvc from "../services/offer-letter.service.js";
import type { Request, Response } from "express";

const createOfferLetterSchema = z.object({
  userId: z.string().min(1),
  variant: z.enum(["TEMPLATE", "TIPTAP_EDITOR"]),
  dynamicFields: z.record(z.string(), z.unknown()).optional(),
  editorContent: z.string().optional(),
});

const updateOfferLetterSchema = z.object({
  dynamicFields: z.record(z.string(), z.unknown()).optional(),
  editorContent: z.string().optional(),
  status: z.enum(["DRAFT", "GENERATED", "SENT"]).optional(),
});

export async function handleListOfferLetters(req: Request, res: Response): Promise<void> {
  const userId = req.query["userId"] as string | undefined;
  const filters = {
    ...(userId !== undefined && { userId }),
    page: req.query["page"] ? parseInt(req.query["page"] as string, 10) : 1,
    limit: req.query["limit"] ? parseInt(req.query["limit"] as string, 10) : 25,
  };
  const result = await olSvc.listOfferLetters(filters);
  res.status(200).json(result);
}

export async function handleGetOfferLetter(req: Request, res: Response): Promise<void> {
  const ol = await olSvc.getOfferLetter(req.params["id"] as string);
  if (!ol) {
    res.status(404).json({ error: "Offer letter not found" });
    return;
  }
  res.status(200).json({ data: ol });
}

export async function handleCreateOfferLetter(req: Request, res: Response): Promise<void> {
  const body = createOfferLetterSchema.parse(req.body);
  const ol = await olSvc.createOfferLetter(
    {
      userId: body.userId,
      variant: body.variant,
      ...(body.dynamicFields ? { dynamicFields: body.dynamicFields } : {}),
      ...(body.editorContent ? { editorContent: body.editorContent } : {}),
    },
    req.user!.id,
  );
  res.status(201).json({ data: ol });
}

export async function handleUpdateOfferLetter(req: Request, res: Response): Promise<void> {
  const body = updateOfferLetterSchema.parse(req.body);
  const clean: Record<string, unknown> = {};
  if (body.dynamicFields !== undefined) clean["dynamicFields"] = body.dynamicFields;
  if (body.editorContent !== undefined) clean["editorContent"] = body.editorContent;
  if (body.status !== undefined) clean["status"] = body.status;
  const ol = await olSvc.updateOfferLetter(req.params["id"] as string, clean);
  res.status(200).json({ data: ol });
}

export async function handleArchiveOfferLetter(req: Request, res: Response): Promise<void> {
  await olSvc.archiveOfferLetter(req.params["id"] as string);
  res.status(200).json({ message: "Offer letter archived" });
}

/** POST /api/v1/offer-letters/:id/generate-pdf — Generate PDF for offer letter */
export async function handleGeneratePdf(req: Request, res: Response): Promise<void> {
  const { generateAndStoreOfferLetterPdf } = await import("../services/pdf.service.js");
  const result = await generateAndStoreOfferLetterPdf(req.params["id"] as string);
  res.status(200).json({ data: result });
}

/** GET /api/v1/offer-letters/:id/preview — §29.4.3 Preview PDF without storing */
export async function handlePreviewPdf(req: Request, res: Response): Promise<void> {
  const { generateOfferLetterPdf } = await import("../services/pdf.service.js");
  const offerSvc = await import("../services/offer-letter.service.js");
  const offerLetter = await offerSvc.getOfferLetter(req.params["id"] as string);
  if (!offerLetter) {
    res.status(404).json({ error: "Offer letter not found" });
    return;
  }
  const buffer = await generateOfferLetterPdf(offerLetter as never);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", 'inline; filename="preview.pdf"');
  res.send(buffer);
}
