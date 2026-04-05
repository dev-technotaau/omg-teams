import type PDFDocument from "pdfkit";

// ──────────────────────────────────────────────
//  Offer Letter Layout Constants
//  Shared between both TEMPLATE and TIPTAP_EDITOR variants
// ──────────────────────────────────────────────

export const PAGE_MARGIN = 60;
export const FONT_SIZE_TITLE = 20;
export const FONT_SIZE_HEADING = 14;
export const FONT_SIZE_BODY = 11;
export const LINE_GAP = 4;
export const SECTION_GAP = 18;

export type PdfDoc = InstanceType<typeof PDFDocument>;
