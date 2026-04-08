import { PAGE_MARGIN, FONT_SIZE_BODY, type PdfDoc } from "./_layout.js";
import { WEBSITE_BAR_HEIGHT } from "./header.js";

// ──────────────────────────────────────────────
//  §29.4.1.1 — Shared Static Footer (Both Variants)
//
//  Signatory block (configurable via PlatformSettings)
//  Contact info (email + address)
//  Yellow website bar (www.opportunitymakers.in)
// ──────────────────────────────────────────────

export interface SignatoryConfig {
  /** URL of the uploaded signature image (or null for line-only) */
  imageUrl: string | null;
  /** Signatory name (default: "Shalini Singh") */
  name: string;
  /** Signatory title (default: "HR Manager") */
  title: string;
}

const DEFAULT_SIGNATORY: SignatoryConfig = {
  imageUrl: null,
  name: "Shalini Singh",
  title: "HR Manager",
};

/**
 * Pre-fetch the signature image buffer so it can be embedded synchronously in the PDF.
 * Returns null if no image URL or fetch fails.
 */
export async function prefetchSignatureImage(url: string | null): Promise<Buffer | null> {
  if (!url) return null;
  try {
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const arrayBuf = await resp.arrayBuffer();
    return Buffer.from(arrayBuf);
  } catch {
    return null;
  }
}

export function renderSignatory(
  doc: PdfDoc,
  config?: SignatoryConfig,
  signatureBuffer?: Buffer | null,
): void {
  const { imageUrl: _imageUrl, name, title } = config ?? DEFAULT_SIGNATORY;

  doc.moveDown(2);
  doc.fontSize(FONT_SIZE_BODY);
  doc.x = PAGE_MARGIN;

  // §29.4.1.1 — Signature image or fallback line
  if (signatureBuffer) {
    try {
      doc.image(signatureBuffer, PAGE_MARGIN, doc.y, { width: 150, height: 60 });
      doc.moveDown(4.5); // space past the image
    } catch {
      // Fallback to line if image embedding fails
      doc
        .moveTo(PAGE_MARGIN, doc.y)
        .lineTo(PAGE_MARGIN + 150, doc.y)
        .stroke("#333333")
        .moveDown(0.3);
    }
  } else {
    doc
      .moveTo(PAGE_MARGIN, doc.y)
      .lineTo(PAGE_MARGIN + 150, doc.y)
      .stroke("#333333")
      .moveDown(0.3);
  }

  doc
    .font("Helvetica-Bold")
    .text(name, PAGE_MARGIN, doc.y, { continued: true })
    .text(`|${title}`)
    .font("Helvetica");
  doc.moveDown(1);
}

/** Draw a filled circle with an icon glyph centered inside. */
function drawIconBadge(
  doc: PdfDoc,
  cx: number,
  cy: number,
  radius: number,
  glyph: string,
  glyphSize: number,
): void {
  doc.save();
  doc.circle(cx, cy, radius).fill("#DAA025");
  doc.fillColor("#001845").font("Helvetica-Bold").fontSize(glyphSize);
  // Center the glyph: PDFKit's heightOfString is close to font size; use a
  // small empirical y-offset so the icon sits visually centered.
  const textW = doc.widthOfString(glyph);
  doc.text(glyph, cx - textW / 2, cy - glyphSize / 2 - 1, { lineBreak: false });
  doc.restore();
  doc.fillColor("#000000").font("Helvetica");
}

export function renderFooter(doc: PdfDoc): void {
  const CONTACT_SIZE = 13;
  const badgeR = 10;
  const rightEdge = doc.page.width - PAGE_MARGIN;
  const badgeCx = rightEdge - badgeR;
  const textRight = badgeCx - badgeR - 6; // leave gap between text and badge
  const textWidth = textRight - PAGE_MARGIN;

  // Contact info sits above the yellow bottom bar (flush to page bottom)
  const barHeight = WEBSITE_BAR_HEIGHT;
  const barY = doc.page.height - barHeight;
  const addressHeight = CONTACT_SIZE * 2 + 4; // two lines
  const emailY = barY - 12 - addressHeight - 6 - CONTACT_SIZE;
  const addrY = emailY + CONTACT_SIZE + 8;

  doc.fillColor("#6B7280").font("Helvetica").fontSize(CONTACT_SIZE);

  // Email — right-aligned
  doc.text("info@opportunitymakers.in", PAGE_MARGIN, emailY, {
    align: "right",
    width: textWidth,
    lineBreak: false,
  });
  drawIconBadge(doc, badgeCx, emailY + CONTACT_SIZE / 2, badgeR, "@", 10);

  // Address — right-aligned, two lines
  doc.fillColor("#6B7280").font("Helvetica").fontSize(CONTACT_SIZE);
  doc.text("302-Village Dhogri Road,", PAGE_MARGIN, addrY, {
    align: "right",
    width: textWidth,
    lineBreak: false,
  });
  doc.text(
    "Tehsil Nangal Salempur-1, Jalandhar, Punjab 144004",
    PAGE_MARGIN,
    addrY + CONTACT_SIZE + 2,
    {
      align: "right",
      width: textWidth,
      lineBreak: false,
    },
  );
  // Location pin badge — centered vertically to the two-line block
  drawIconBadge(doc, badgeCx, addrY + CONTACT_SIZE + 2, badgeR, "\u25CF", 9);

  // Reset
  doc.fillColor("#000000");

  // Website text overlays the bottom gold bar drawn by renderDecorativeCorners
  doc
    .fontSize(CONTACT_SIZE + 1)
    .font("Helvetica-Bold")
    .fillColor("#001845")
    .text("www.opportunitymakers.in", PAGE_MARGIN, barY + (barHeight - (CONTACT_SIZE + 1)) / 2, {
      align: "right",
      width: doc.page.width - PAGE_MARGIN * 2,
      lineBreak: false,
    });
  doc.fillColor("#000000");
}
