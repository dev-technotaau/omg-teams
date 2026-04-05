import { stripHtml } from "./_helpers.js";
import { FONT_SIZE_HEADING, FONT_SIZE_BODY, LINE_GAP, type PdfDoc } from "./_layout.js";

// ──────────────────────────────────────────────
//  §29.4.1.3 — Variant 2: Tiptap Rich Text Editor Body
//
//  Admin writes custom body content via the Tiptap editor.
//  Content is stored as HTML, stripped to plain text for
//  PDFKit rendering. {{placeholders}} are already replaced
//  before this function is called.
// ──────────────────────────────────────────────

export function renderEditorVariant(doc: PdfDoc, htmlContent: string): void {
  doc.fontSize(FONT_SIZE_HEADING).font("Helvetica-Bold").text("Offer Details").moveDown(0.3);

  const plainText = stripHtml(htmlContent);

  doc
    .fontSize(FONT_SIZE_BODY)
    .font("Helvetica")
    .text(plainText, { lineGap: LINE_GAP, paragraphGap: 8 });
}
