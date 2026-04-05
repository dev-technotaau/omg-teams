// ──────────────────────────────────────────────
//  Offer Letter Templates — Barrel Export
//  §29.4 — All template components for PDF generation
// ──────────────────────────────────────────────

export {
  PAGE_MARGIN,
  FONT_SIZE_TITLE,
  FONT_SIZE_HEADING,
  FONT_SIZE_BODY,
  LINE_GAP,
  SECTION_GAP,
} from "./_layout.js";
export type { PdfDoc } from "./_layout.js";
export { stripHtml, formatDate } from "./_helpers.js";
export {
  prefetchLogo,
  renderWatermark,
  renderDecorativeCorners,
  renderHeader,
  renderEmployeeDetails,
} from "./header.js";
export { renderSignatory, renderFooter, prefetchSignatureImage } from "./footer.js";
export type { SignatoryConfig } from "./footer.js";
export { renderTemplateVariant } from "./template-body.js";
export { renderEditorVariant } from "./editor-body.js";
