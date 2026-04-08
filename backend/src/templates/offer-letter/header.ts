import { PAGE_MARGIN, FONT_SIZE_BODY, type PdfDoc } from "./_layout.js";

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
  const text = "Opportunity Makers Group";
  const fontSize = 50;
  const cx = doc.page.width / 2;
  const cy = doc.page.height / 2;

  doc.save();
  doc.opacity(0.06);
  doc.fontSize(fontSize).font("Helvetica-Bold");

  // Measure the text so we can center it exactly on the page midpoint
  // before rotating around that same midpoint.
  const textWidth = doc.widthOfString(text);
  const textHeight = doc.currentLineHeight();

  doc.rotate(-45, { origin: [cx, cy] });
  doc.fillColor("#000000").text(text, cx - textWidth / 2, cy - textHeight / 2, {
    lineBreak: false,
  });
  doc.restore();
  doc.opacity(1);
}

// Gold bars are flush to the top and bottom edges of the page.
export const WEBSITE_BAR_HEIGHT = 28;

/**
 * Draws the letterhead decoration:
 *   • Full-width gold bars on top and bottom edges (with 45° diagonal cuts
 *     where they meet the chevrons).
 *   • Top-right triple-layer chevron: outermost thin gold outline, middle
 *     thick navy, innermost thick gold — all at 45°, with uniform negative
 *     space between layers.
 *   • Bottom-left chevron: exact 180° rotation of the top-right.
 */
export function renderDecorativeCorners(doc: PdfDoc): void {
  const w = doc.page.width;
  const h = doc.page.height;
  const GOLD = "#DAA025";
  const NAVY = "#001845";

  const BAR = WEBSITE_BAR_HEIGHT;
  const THICK = 16; // stroke width of the two solid chevrons
  const THIN = 2.5; // stroke width of the outermost gold outline
  const GAP = 9; // uniform negative space between layers (perpendicular)

  // Perpendicular step between centerlines, converted to an apex offset.
  // For a 45° stripe, shifting the apex by (-s, +s) moves the centerline
  // perpendicularly by s * √2, so s = perp / √2.
  const SQRT2 = Math.SQRT2;
  const stepOutlineToNavy = (THIN / 2 + GAP + THICK / 2) / SQRT2;
  const stepNavyToGold = (THICK / 2 + GAP + THICK / 2) / SQRT2;

  // Apex of the outermost (gold outline) chevron in the top-right.
  // Picked so the legs bleed cleanly off the top bar and right edge.
  const apex1 = { x: w - 150, y: 120 };
  const apex2 = { x: apex1.x - stepOutlineToNavy, y: apex1.y + stepOutlineToNavy };
  const apex3 = { x: apex2.x - stepNavyToGold, y: apex2.y + stepNavyToGold };

  /** Draw a V-chevron for the top-right corner. Legs bleed off top & right. */
  const drawTopRight = (apex: { x: number; y: number }, lw: number, color: string) => {
    const ax = apex.x;
    const ay = apex.y;
    // Upper leg hits y = -overflow (bleeds above page) at x = ax + ay + overflow
    // Right leg hits x = w + overflow at y = ay + (w - ax) + overflow
    const over = lw; // overflow so the stroke bleeds fully off the edge
    const upperEnd: [number, number] = [ax + ay + over, -over];
    const rightEnd: [number, number] = [w + over, ay + (w - ax) + over];
    doc
      .lineWidth(lw)
      .lineCap("butt")
      .lineJoin("miter")
      .moveTo(upperEnd[0], upperEnd[1])
      .lineTo(ax, ay)
      .lineTo(rightEnd[0], rightEnd[1])
      .stroke(color);
  };

  /** Draw the mirrored V-chevron for the bottom-left corner. */
  const drawBottomLeft = (apex: { x: number; y: number }, lw: number, color: string) => {
    // Mirror point (x, y) → (w - x, h - y)
    const ax = w - apex.x;
    const ay = h - apex.y;
    const over = lw;
    // Mirror of upperEnd (ax + ay + over, -over): (w - ax - ay - over, h + over)
    const lowerEnd: [number, number] = [ax - (h - BAR - ay) - over, h + over];
    // Mirror of rightEnd (w + over, ay + w - ax' + over) where ax' is original:
    // Simpler — recompute from mirrored apex: left leg heads up-left at 45°,
    // hits x = -over at y = ay - ax - over.
    const leftEnd: [number, number] = [-over, ay - ax - over];
    doc
      .lineWidth(lw)
      .lineCap("butt")
      .lineJoin("miter")
      .moveTo(lowerEnd[0], lowerEnd[1])
      .lineTo(ax, ay)
      .lineTo(leftEnd[0], leftEnd[1])
      .stroke(color);
  };

  doc.save();

  // ── 1. Chevrons first (so the bars can overdraw for clean diagonal cuts)
  // Top-right, outer → inner order doesn't matter with no overlap.
  drawTopRight(apex3, THICK, GOLD); // innermost (closest to corner tip)
  drawTopRight(apex2, THICK, NAVY); // middle
  drawTopRight(apex1, THIN, GOLD); // outermost (closest to banner)

  drawBottomLeft(apex3, THICK, GOLD);
  drawBottomLeft(apex2, THICK, NAVY);
  drawBottomLeft(apex1, THIN, GOLD);

  // ── 2. Gold banners with diagonal cut on the chevron-facing end ─────────
  // The cut must be parallel to the chevrons (45°) and sit GAP perp away
  // from the outermost gold outline. Outer edge of outline layer meets the
  // top edge at x = apex1.x + apex1.y - THIN/2 * √2. Back off by another
  // (GAP + THIN/2) * √2 to leave the negative-space gutter.
  const barCutPerp = (THIN + GAP) * SQRT2; // horizontal back-off on top edge
  const topCutX = apex1.x + apex1.y - barCutPerp;
  // Top bar polygon: left edge → top edge → 45° cut → bottom edge → back
  doc.polygon([0, 0], [topCutX, 0], [topCutX - BAR, BAR], [0, BAR]).fill(GOLD);

  // Bottom bar: 180° mirror of the top bar cut
  const botCutX = w - topCutX;
  doc.polygon([w, h], [botCutX, h], [botCutX + BAR, h - BAR], [w, h - BAR]).fill(GOLD);

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
    const url = `${env.FRONTEND_URL}/icons/logo-light-theme.png`;
    const res = await fetch(url);
    if (res.ok) {
      cachedLogoBuffer = Buffer.from(await res.arrayBuffer());
    }
  } catch {
    // Logo not available — will use text fallback
  }
}

export function renderHeader(doc: PdfDoc, generatedAt: Date, _referenceNumber: string): void {
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

  doc.moveDown(2);

  // "Offer Letter" — right-aligned, bold, slightly larger than body
  doc
    .fontSize(FONT_SIZE_BODY + 2)
    .font("Helvetica-Bold")
    .text("Offer Letter", PAGE_MARGIN, doc.y, {
      align: "right",
      width: doc.page.width - PAGE_MARGIN * 2,
    })
    .moveDown(0.3);

  // Date — right-aligned, directly below the title
  const dateStr = generatedAt
    .toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })
    .replace(/ /g, "-");
  doc
    .fontSize(FONT_SIZE_BODY)
    .font("Helvetica-Bold")
    .text("Date: ", PAGE_MARGIN, doc.y, {
      continued: true,
      align: "right",
      width: doc.page.width - PAGE_MARGIN * 2,
    })
    .font("Helvetica")
    .text(dateStr)
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
