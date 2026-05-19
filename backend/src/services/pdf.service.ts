import crypto from "node:crypto";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import PDFDocument from "pdfkit";
import { env } from "../config/env.js";
import { getR2, cloudinary } from "../config/storage.js";
import { ErrorCode } from "../constants/error-codes.js";
import { HttpStatus } from "../constants/http-status.js";
import { AppError } from "../exceptions/app-error.js";
import { logger } from "../instrument.js";
import { getOfferLetter, updateOfferLetter } from "./offer-letter.service.js";
import {
  PAGE_MARGIN,
  FONT_SIZE_BODY,
  LINE_GAP,
  formatDate,
  prefetchLogo,
  renderWatermark,
  renderDecorativeCorners,
  renderHeader,
  renderSignatory,
  renderFooter,
  renderTemplateVariant,
  renderEditorVariant,
  prefetchSignatureImage,
} from "../templates/offer-letter/index.js";
import type { SignatoryConfig } from "../templates/offer-letter/index.js";

// ──────────────────────────────────────────────
//  PDF Generation Service — §29.4
//  Orchestrates offer letter PDF generation using
//  template components from templates/offer-letter/
// ──────────────────────────────────────────────

interface OfferLetterData {
  id: string;
  referenceNumber: string;
  variant: string; // "TEMPLATE" | "TIPTAP_EDITOR"
  dynamicFields: Record<string, unknown> | null;
  editorContent: string | null;
  generatedAt: Date;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    employeeId: string | null;
    email: string;
  };
}

/**
 * Fetch signatory configuration from PlatformSettings.
 * Returns defaults if no settings are configured.
 */
async function getSignatoryConfig(): Promise<{
  config: SignatoryConfig;
  signatureBuffer: Buffer | null;
}> {
  const { getSetting } = await import("./settings.service.js");

  const [storageKeySetting, backendSetting, nameSetting, titleSetting] = await Promise.all([
    getSetting("offer_letter_signature_storage_key"),
    getSetting("offer_letter_signature_storage_backend"),
    getSetting("offer_letter_signatory_name"),
    getSetting("offer_letter_signatory_title"),
  ]);

  const storageKey = (storageKeySetting?.value as string) || null;
  const rawBackend = backendSetting?.value as string | null | undefined;
  const backend = rawBackend === "CLOUDINARY" || rawBackend === "R2" ? rawBackend : null;
  const name = (nameSetting?.value as string) || "Shalini Singh";
  const title = (titleSetting?.value as string) || "HR Manager";

  // Generate a fresh signed URL from the storage key for fetching
  let imageUrl: string | null = null;
  if (storageKey) {
    try {
      const { getSignedDownloadUrl } = await import("../utils/signed-url.js");
      imageUrl = await getSignedDownloadUrl(storageKey, { ttlSeconds: 60, backend });
    } catch {
      // Fall back to no image
    }
  }

  const signatureBuffer = await prefetchSignatureImage(imageUrl);

  return { config: { imageUrl, name, title }, signatureBuffer };
}

/**
 * Generate a PDF buffer for the given offer letter data.
 * Uses template components from templates/offer-letter/ folder.
 */
export async function generateOfferLetterPdf(offerLetter: OfferLetterData): Promise<Buffer> {
  // Fetch logo + signatory config before entering the sync PDF stream
  const [, signatoryData] = await Promise.all([prefetchLogo(), getSignatoryConfig()]);
  const { config: signatoryConfig, signatureBuffer } = signatoryData;

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: PAGE_MARGIN, bottom: PAGE_MARGIN, left: PAGE_MARGIN, right: PAGE_MARGIN },
      info: {
        Title: `Offer Letter - ${offerLetter.referenceNumber}`,
        Author: "OMG Teams",
        Subject: "Offer Letter",
      },
    });

    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    // ── Shared elements (both variants) ──
    renderWatermark(doc);
    renderDecorativeCorners(doc);
    renderHeader(doc, offerLetter.generatedAt, offerLetter.referenceNumber);

    // ── Body — variant-specific ──
    // §29.4.2 — Replace {{placeholder}} tokens with dynamic field values in both variants
    const dynamicFields = offerLetter.dynamicFields ?? {};
    const user = offerLetter.user;
    // Add auto-derived fields
    dynamicFields["employeeName"] ??= `${user.firstName} ${user.lastName}`;
    dynamicFields["employeeEmail"] ??= user.email;
    dynamicFields["employeeId"] ??= user.employeeId ?? "";
    dynamicFields["dateOfIssue"] ??= formatDate(offerLetter.generatedAt);
    dynamicFields["referenceNumber"] ??= offerLetter.referenceNumber;

    if (offerLetter.variant === "TEMPLATE" && offerLetter.dynamicFields) {
      renderTemplateVariant(doc, offerLetter.dynamicFields);
    } else if (offerLetter.variant === "TIPTAP_EDITOR" && offerLetter.editorContent) {
      // §29.4.1.3 — Replace {{field}} placeholders in editor content before rendering
      let content = offerLetter.editorContent;
      for (const [key, value] of Object.entries(dynamicFields)) {
        content = content.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), String(value ?? ""));
      }
      renderEditorVariant(doc, content);
    } else {
      doc
        .fontSize(FONT_SIZE_BODY)
        .text("No additional content available for this offer letter.", { lineGap: LINE_GAP });
    }

    // ── Shared elements (both variants) ──
    renderSignatory(doc, signatoryConfig, signatureBuffer);
    renderFooter(doc);

    doc.end();
  });
}

/**
 * Generate an offer letter PDF, upload to Cloudinary (primary) or R2 (fallback),
 * and update the database record. Returns the public URL.
 */
export async function generateAndStoreOfferLetterPdf(offerId: string): Promise<string> {
  const offerLetter = await getOfferLetter(offerId);
  if (!offerLetter) {
    throw new AppError("Offer letter not found", HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND);
  }

  const pdfBuffer = await generateOfferLetterPdf(offerLetter as OfferLetterData);

  // Compute SHA-256 hash for integrity verification
  const hash = crypto.createHash("sha256").update(pdfBuffer).digest("hex");

  let storageKey: string;
  let storageBackend: "CLOUDINARY" | "R2";

  if (env.hasCloudinary) {
    // Upload to Cloudinary as raw PDF
    const folder = `offer-letters/${offerLetter.user.id}`;

    const result = await new Promise<{ public_id: string }>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder,
          public_id: offerLetter.referenceNumber,
          resource_type: "raw",
          overwrite: true,
          type: "authenticated", // Require signed URLs for access
        },
        (err, res) => {
          if (err || !res) {
            reject(err instanceof Error ? err : new Error("Cloudinary upload returned no result"));
            return;
          }
          resolve({ public_id: res.public_id });
        },
      );
      stream.end(pdfBuffer);
    });

    storageKey = result.public_id;
    storageBackend = "CLOUDINARY";
    logger.info("Offer letter PDF uploaded to Cloudinary (authenticated)", {
      offerId,
      publicId: storageKey,
      size: pdfBuffer.length,
    });
  } else if (env.hasR2) {
    // Fallback to R2
    storageKey = `offer-letters/${offerLetter.user.id}/${offerLetter.referenceNumber}.pdf`;
    storageBackend = "R2";
    const r2 = getR2();

    await r2.send(
      new PutObjectCommand({
        Bucket: env.R2_BUCKET,
        Key: storageKey,
        Body: pdfBuffer,
        ContentType: "application/pdf",
        ContentDisposition: `attachment; filename="${offerLetter.referenceNumber}.pdf"`,
      }),
    );

    logger.info("Offer letter PDF uploaded to R2", {
      offerId,
      storageKey,
      size: pdfBuffer.length,
    });
  } else {
    throw new AppError(
      "No storage backend configured. Set Cloudinary or R2 credentials.",
      HttpStatus.INTERNAL_SERVER_ERROR,
      ErrorCode.INTERNAL_ERROR,
    );
  }

  // Generate a signed URL for the response
  const { getSignedDownloadUrl } = await import("../utils/signed-url.js");
  const signedUrl = await getSignedDownloadUrl(storageKey, {
    backend: storageBackend,
    contentDisposition: `attachment; filename="${offerLetter.referenceNumber}.pdf"`,
    resourceType: "raw",
  });

  // Store the storageKey + backend (for regenerating signed URLs later)
  await updateOfferLetter(offerId, {
    generatedFileUrl: signedUrl,
    generatedFileHash: hash,
    storageKey,
    storageBackend,
  });

  return signedUrl;
}
