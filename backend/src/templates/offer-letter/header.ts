import { PAGE_MARGIN, FONT_SIZE_TITLE, FONT_SIZE_BODY, type PdfDoc } from "./_layout.js";

// ──────────────────────────────────────────────
//  §29.4.1.1 — Shared Static Header (Both Variants)
//
//  Company name + tagline (top-left)
//  Date (top-right)
//  "Offer Letter" title (centered, italic)
//  Decorative corner triangles (yellow/navy)
//  Watermark (semi-transparent, rotated)
// ──────────────────────────────────────────────

export function renderWatermark(doc: PdfDoc): void {
  doc.save();
  doc.opacity(0.06);
  doc
    .fontSize(60)
    .font("Helvetica-Bold")
    .rotate(-45, { origin: [doc.page.width / 2, doc.page.height / 2] })
    .text("OMG TEAMS", 100, doc.page.height / 2 - 30, {
      width: doc.page.width,
      align: "center",
    });
  doc.restore();
  doc.opacity(1);
}

export function renderDecorativeCorners(doc: PdfDoc): void {
  doc.save();
  // Top-left corner — large navy triangle + gold accent (matching actual PDF)
  doc.polygon([0, 0], [100, 0], [0, 100]).fill("#001845");
  doc.polygon([0, 0], [60, 0], [0, 60]).fill("#DAA025");

  // Top-right corner — large navy triangle + gold accent (matching actual PDF)
  doc
    .polygon([doc.page.width, 0], [doc.page.width - 100, 0], [doc.page.width, 100])
    .fill("#001845");
  doc.polygon([doc.page.width, 0], [doc.page.width - 60, 0], [doc.page.width, 60]).fill("#DAA025");
  doc.restore();
  doc.fillColor("#000000");
}

/**
 * Cached logo buffer — fetched once from frontend, reused for all PDFs.
 * Logo hosted at: ${FRONTEND_URL}/icons/omg-logo-header.png
 * Same hosting pattern as email templates.
 */
let cachedLogoBuffer: Buffer | null = null;
let logoFetched = false;

/**
 * Pre-fetch the logo from the frontend before PDF generation.
 * Must be called (and awaited) before renderHeader().
 */
export async function prefetchLogo(): Promise<void> {
  if (logoFetched) return;
  logoFetched = true;
  try {
    const { env } = await import("../../config/env.js");
    const url = `${env.FRONTEND_URL}/icons/logo.png`;
    const res = await fetch(url);
    if (res.ok) {
      cachedLogoBuffer = Buffer.from(await res.arrayBuffer());
    }
  } catch {
    // Logo not available — will use text fallback
  }
}

export function renderHeader(doc: PdfDoc, generatedAt: Date, referenceNumber: string): void {
  // §29.4.1.1 — Full company logo block (emblem + company name + tagline as ONE image)
  // Hosted at: ${FRONTEND_URL}/icons/omg-logo-header.png
  // Contains: circular OMG emblem + "OPPORTUNITY MAKERS GROUP" + "You dream it, we make it."
  if (cachedLogoBuffer) {
    doc.image(cachedLogoBuffer, PAGE_MARGIN, PAGE_MARGIN, { width: 200 });
  } else {
    // Fallback: render as text if logo image not available
    doc
      .fontSize(16)
      .font("Helvetica-Bold")
      .text("OPPORTUNITY", PAGE_MARGIN, PAGE_MARGIN)
      .text("MAKERS GROUP")
      .fontSize(10)
      .font("Helvetica-Oblique")
      .fillColor("#DAA025")
      .text("You dream it, we make it.")
      .fillColor("#000000");
  }

  // Date (top-right) — format: "Date: DD-MMM-YYYY" matching actual PDF
  const dateStr = generatedAt
    .toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })
    .replace(/ /g, "-");
  doc
    .fontSize(FONT_SIZE_BODY)
    .font("Helvetica")
    .text(`Date: ${dateStr}`, PAGE_MARGIN, PAGE_MARGIN + 10, {
      align: "right",
      width: doc.page.width - PAGE_MARGIN * 2,
    });

  doc.moveDown(2);

  // "Offer Letter" title (centered, italic)
  doc
    .fontSize(FONT_SIZE_TITLE)
    .font("Helvetica-Oblique")
    .text("Offer Letter", { align: "center" })
    .moveDown(0.5);

  // Reference number
  doc
    .fontSize(FONT_SIZE_BODY)
    .font("Helvetica")
    .text(`Ref: ${referenceNumber}`, { align: "right" })
    .moveDown(1);
}

export function renderEmployeeDetails(
  doc: PdfDoc,
  user: { firstName: string; lastName: string; email: string; employeeId: string | null },
): void {
  doc.fontSize(14).font("Helvetica-Bold").text("Employee Details").moveDown(0.3);
  doc.fontSize(FONT_SIZE_BODY).font("Helvetica");

  const details: [string, string][] = [
    ["Name", `${user.firstName} ${user.lastName}`],
    ["Email", user.email],
  ];
  if (user.employeeId) {
    details.push(["Employee ID", user.employeeId]);
  }

  for (const [label, value] of details) {
    doc
      .text(`${label}: `, { continued: true })
      .font("Helvetica-Bold")
      .text(value)
      .font("Helvetica");
  }
  doc.moveDown(18 / FONT_SIZE_BODY);
}
