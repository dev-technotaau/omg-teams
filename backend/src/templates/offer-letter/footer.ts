import { PAGE_MARGIN, FONT_SIZE_BODY, type PdfDoc } from "./_layout.js";

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

  // §29.4.1.1 — Signature image or fallback line
  if (signatureBuffer) {
    try {
      doc.image(signatureBuffer, doc.x, doc.y, { width: 150, height: 60 });
      doc.moveDown(4.5); // space past the image
    } catch {
      // Fallback to line if image embedding fails
      doc
        .moveTo(doc.x, doc.y)
        .lineTo(doc.x + 150, doc.y)
        .stroke("#333333")
        .moveDown(0.3);
    }
  } else {
    doc
      .moveTo(doc.x, doc.y)
      .lineTo(doc.x + 150, doc.y)
      .stroke("#333333")
      .moveDown(0.3);
  }

  doc.font("Helvetica-Bold").text(name, { continued: true }).font("Helvetica").text(`|${title}`);
  doc.moveDown(1);
}

export function renderFooter(doc: PdfDoc): void {
  // Contact info — right-aligned with icons (matching actual PDF)
  const footerY = doc.page.height - PAGE_MARGIN - 80;
  const rightEdge = doc.page.width - PAGE_MARGIN;

  // Email with mail icon
  doc
    .fontSize(9)
    .font("Helvetica")
    .text("info@opportunitymakers.in", PAGE_MARGIN, footerY, {
      align: "right",
      width: rightEdge - PAGE_MARGIN - 25,
    });
  // Mail icon (✉) — using Unicode
  doc.text("\u2709", rightEdge - 18, footerY, { width: 18 });

  // Address with location icon
  const addrY = footerY + 18;
  doc
    .text("302-Village Dhogri Road,", PAGE_MARGIN, addrY, {
      align: "right",
      width: rightEdge - PAGE_MARGIN - 25,
    })
    .text("Tehsil Nangal Salempur-1, Jalandhar, Punjab 144004", {
      align: "right",
      width: rightEdge - PAGE_MARGIN - 25,
    });
  // Location pin icon (using bullet as proxy — PDFKit doesn't have icon fonts)
  doc.fontSize(12).text("\u25CF", rightEdge - 18, addrY + 5, { width: 18 });
  doc.fontSize(9);

  doc.moveDown(0.5);

  // Yellow website bar at very bottom
  const barY = doc.page.height - PAGE_MARGIN - 20;
  doc.rect(PAGE_MARGIN, barY, doc.page.width - PAGE_MARGIN * 2, 18).fill("#DAA025");
  doc
    .fontSize(9)
    .font("Helvetica-Bold")
    .fillColor("#FFFFFF")
    .text("www.opportunitymakers.in", PAGE_MARGIN + 10, barY + 4, {
      align: "right",
      width: doc.page.width - PAGE_MARGIN * 2 - 20,
    });
  doc.fillColor("#000000"); // Reset fill
}
