import { PAGE_MARGIN, FONT_SIZE_BODY, LINE_GAP, type PdfDoc } from "./_layout.js";

// ──────────────────────────────────────────────
//  §29.4.1.2 — Variant 1: Static + Dynamic Template
//
//  Pre-built boilerplate legal text with dynamic field
//  placeholders auto-filled with employee data.
//  6 numbered sections + greeting + welcome message.
// ──────────────────────────────────────────────

/** Standard keys already rendered in the boilerplate — skip in additional fields */
const STANDARD_KEYS = new Set([
  "employeeName",
  "positionTitle",
  "designation",
  "joiningDate",
  "joiningDateISO",
  "dateOfJoining",
  "salaryAmount",
  "ctc",
  "probationPeriod",
  "noticePeriod",
  "employeeId",
  "employeeEmail",
  "dateOfIssue",
  "referenceNumber",
  // §29.4 — Work mode + timings + weekly offs are split fields on the form
  // but rendered into the boilerplate prose, not as a key/value pair below.
  "workMode",
  "officeStartTime",
  "officeEndTime",
  "weeklyOffs",
]);

/**
 * Long-form labels for the work-mode codes the form sends. The same code is
 * rendered in two places: long form in the position-title sentence, short
 * form (the code itself) inside the office-timings sentence.
 */
const WORK_MODE_LABELS: Record<string, string> = {
  WFH: "Work From Home",
  WFO: "Work From Office",
  HYBRID: "Hybrid",
};

/** Convert "HH:mm" (24h) to "h:mm AM/PM". Falls back to the input on bad data. */
function formatTime12(hhmm: string): string {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (!m) return hhmm;
  const h24 = Number(m[1]);
  const min = m[2];
  if (Number.isNaN(h24) || h24 < 0 || h24 > 23) return hhmm;
  const period = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${min} ${period}`;
}

/**
 * Join a list of weekly-off day names with English-style "and" / Oxford
 * comma rules:
 *   1     → "Sunday"
 *   2     → "Sunday and Saturday"
 *   3+    → "Sunday, Saturday, and Friday"
 */
function formatWeeklyOffs(days: unknown): string {
  const list = Array.isArray(days)
    ? days.filter((d): d is string => typeof d === "string" && d.trim().length > 0)
    : [];
  if (list.length === 0) return "Sunday";
  if (list.length === 1) return list[0]!;
  if (list.length === 2) return `${list[0]} and ${list[1]}`;
  return `${list.slice(0, -1).join(", ")}, and ${list[list.length - 1]}`;
}

/** Known field labels for non-standard additional fields */
const LABEL_MAP: Record<string, string> = {
  designation: "Designation",
  department: "Department",
  joiningDate: "Date of Joining",
  ctc: "CTC (Annual)",
  basicSalary: "Basic Salary",
  hra: "HRA",
  specialAllowance: "Special Allowance",
  probationPeriod: "Probation Period",
  noticePeriod: "Notice Period",
  workLocation: "Work Location",
  reportingManager: "Reporting Manager",
};

export function renderTemplateVariant(doc: PdfDoc, fields: Record<string, unknown>): void {
  const name = String(fields["employeeName"] ?? "Employee");
  const positionTitle = String(
    fields["positionTitle"] ?? fields["designation"] ?? "Hiring Associate",
  );
  const joinDate = String(fields["joiningDate"] ?? fields["dateOfJoining"] ?? "TBD");
  const salary = String(fields["salaryAmount"] ?? fields["ctc"] ?? "as discussed");
  const probation = String(fields["probationPeriod"] ?? "2 months");
  const notice = String(fields["noticePeriod"] ?? "15 Days");

  // §29.4 — Work mode is a single field driving two renders: long form
  // appended to the position title, short code (uppercase) inside section 3.
  const workModeCode = String(fields["workMode"] ?? "WFH").toUpperCase();
  const workModeLong = WORK_MODE_LABELS[workModeCode] ?? workModeCode;
  const position = `${positionTitle} (${workModeLong})`;

  const officeStart = formatTime12(String(fields["officeStartTime"] ?? "10:00"));
  const officeEnd = formatTime12(String(fields["officeEndTime"] ?? "18:00"));
  const weeklyOffsText = formatWeeklyOffs(fields["weeklyOffs"] ?? ["Sunday"]);

  // Layout constants
  const contentWidth = doc.page.width - PAGE_MARGIN * 2;
  const bodyIndent = PAGE_MARGIN + 20;
  const bodyWidth = contentWidth - 20;

  doc.fontSize(FONT_SIZE_BODY).font("Helvetica");

  // §29.4.1.4 — Greeting
  doc
    .font("Helvetica-Bold")
    .text(`Dear ${name},`, PAGE_MARGIN, doc.y, { lineGap: LINE_GAP, width: contentWidth })
    .font("Helvetica");
  doc.moveDown(0.5);

  // Introduction paragraph
  doc.text(
    "With reference to your interview at our organization, we are pleased to extend an offer for the position of ",
    PAGE_MARGIN,
    doc.y,
    { continued: true, lineGap: LINE_GAP, width: contentWidth },
  );
  doc.font("Helvetica-Bold").text(position, { continued: true });
  doc.font("Helvetica").text(" with ", { continued: true });
  doc.font("Helvetica-Bold").text("Opportunity Makers Group", { continued: true });
  doc.font("Helvetica").text(", on the terms and conditions mutually agreed and mentioned below:");
  doc.moveDown(0.6);

  /**
   * Render a numbered section: bold heading on its own line, then body
   * paragraph indented below. Using ONE text() call per line avoids PDFKit
   * carrying a stale width constraint across continued flows.
   */
  const section = (heading: string, body: () => void) => {
    doc.font("Helvetica-Bold").fontSize(FONT_SIZE_BODY).text(heading, PAGE_MARGIN, doc.y, {
      width: contentWidth,
      lineGap: LINE_GAP,
    });
    doc.font("Helvetica");
    body();
    doc.moveDown(0.5);
  };

  // Section 1 — APPOINTMENT
  section("1. APPOINTMENT", () => {
    doc.text("This appointment is effective from ", bodyIndent, doc.y, {
      continued: true,
      lineGap: LINE_GAP,
      width: bodyWidth,
    });
    doc.font("Helvetica-Bold").text(`${joinDate}.`);
    doc.font("Helvetica");
  });

  // Section 2 — EMOLUMENTS
  section("2. EMOLUMENTS", () => {
    doc.text("Your monthly in-hand salary will be ", bodyIndent, doc.y, {
      continued: true,
      lineGap: LINE_GAP,
      width: bodyWidth,
    });
    doc.font("Helvetica-Bold").text(salary, { continued: true });
    doc.font("Helvetica").text(", payable directly to your registered bank account.");
  });

  // Section 3 — OFFICE TIMINGS AND LEAVES
  section("3. OFFICE TIMINGS AND LEAVES", () => {
    doc.text(
      `Office timings will be ${officeStart} to ${officeEnd} (${workModeCode}) with ${weeklyOffsText} as weekly off. Leave must be informed at least one day in advance, subject to company policy.`,
      bodyIndent,
      doc.y,
      { lineGap: LINE_GAP, width: bodyWidth },
    );
  });

  // Section 4 — Terms & Conditions
  section("4. Terms & Conditions", () => {
    doc.text("You shall be on probation for a period of ", bodyIndent, doc.y, {
      continued: true,
      lineGap: LINE_GAP,
      width: bodyWidth,
    });
    doc.font("Helvetica-Bold").text(probation, { continued: true });
    doc
      .font("Helvetica")
      .text(
        " from the date of joining, during which your performance and suitability for the position will be evaluated.",
      );
    doc.font("Helvetica-Bold").text("Notice Period: ", bodyIndent, doc.y, {
      continued: true,
      width: bodyWidth,
    });
    doc.text(notice);
    doc.font("Helvetica");
  });

  // Section 5 — Code of Conduct & Policies
  section("5. Code of Conduct & Policies", () => {
    doc.text(
      "You are expected to comply with company policies, maintain discipline, safeguard confidential information, and uphold professionalism and ethical hiring practices at all times.",
      bodyIndent,
      doc.y,
      { lineGap: LINE_GAP, width: bodyWidth },
    );
  });

  // Section 6 — Acknowledgment & Acceptance
  section("6. Acknowledgment & Acceptance", () => {
    doc.text(
      "By signing below, the candidate confirms acceptance of all terms and conditions of this offer",
      bodyIndent,
      doc.y,
      { lineGap: LINE_GAP, width: bodyWidth },
    );
  });

  doc.moveDown(0.3);

  // Welcome message (reset x to left margin — previous section left it indented)
  doc
    .font("Helvetica-BoldOblique")
    .text(
      "We welcome you to the Opportunity Makers Group family and wish you success in your onboarding and future with us.",
      PAGE_MARGIN,
      doc.y,
      { lineGap: LINE_GAP, width: contentWidth },
    )
    .font("Helvetica");
  doc.moveDown(1);

  // Render only non-standard additional fields
  doc.fontSize(FONT_SIZE_BODY).font("Helvetica");
  for (const [key, value] of Object.entries(fields)) {
    if (value === null || value === undefined || value === "") continue;
    if (STANDARD_KEYS.has(key)) continue;
    const label =
      LABEL_MAP[key] ?? key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase());
    doc
      .font("Helvetica-Bold")
      .text(`${label}: `, PAGE_MARGIN, doc.y, {
        continued: true,
        width: contentWidth,
      })
      .font("Helvetica")
      .text(String(value), { lineGap: LINE_GAP });
  }
}
