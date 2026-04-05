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
  "dateOfJoining",
  "salaryAmount",
  "ctc",
  "probationPeriod",
  "noticePeriod",
  "employeeId",
  "employeeEmail",
  "dateOfIssue",
  "referenceNumber",
]);

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
  const position = String(fields["positionTitle"] ?? fields["designation"] ?? "Hiring Associate");
  const joinDate = String(fields["joiningDate"] ?? fields["dateOfJoining"] ?? "TBD");
  const salary = String(fields["salaryAmount"] ?? fields["ctc"] ?? "as discussed");
  const probation = String(fields["probationPeriod"] ?? "2 months");
  const notice = String(fields["noticePeriod"] ?? "15 Days");

  doc.fontSize(FONT_SIZE_BODY).font("Helvetica");

  // §29.4.1.4 — Greeting
  doc.text(`Dear ${name},`, { lineGap: LINE_GAP }).moveDown(0.5);

  // Introduction paragraph
  doc.text(
    `With reference to your interview at our organization, we are pleased to extend an offer for the position of `,
    { continued: true, lineGap: LINE_GAP },
  );
  doc.font("Helvetica-Bold").text(position, { continued: true });
  doc.font("Helvetica").text(` with `, { continued: true });
  doc.font("Helvetica-Bold").text("Opportunity Makers Group", { continued: true });
  doc.font("Helvetica").text(`, on the terms and conditions mutually agreed and mentioned below:`);
  doc.moveDown(0.5);

  // Body indent for section content (matching actual PDF layout)
  const bodyIndent = PAGE_MARGIN + 30;
  const bodyWidth = 420;

  // Section 1 — APPOINTMENT (ALL CAPS heading per actual PDF)
  doc.font("Helvetica-Bold").text("1.", PAGE_MARGIN, doc.y, { continued: true, width: 20 });
  doc.text("  APPOINTMENT").font("Helvetica");
  doc.text(`This appointment is effective from `, bodyIndent, doc.y, {
    continued: true,
    lineGap: LINE_GAP,
    width: bodyWidth,
  });
  doc.font("Helvetica-Bold").text(`${joinDate}.`).font("Helvetica");
  doc.moveDown(0.3);

  // Section 2 — EMOLUMENTS (ALL CAPS heading per actual PDF)
  doc.font("Helvetica-Bold").text("2.", PAGE_MARGIN, doc.y, { continued: true, width: 20 });
  doc.text("  EMOLUMENTS").font("Helvetica");
  doc.text(`Your monthly in-hand salary will be `, bodyIndent, doc.y, {
    continued: true,
    lineGap: LINE_GAP,
    width: bodyWidth,
  });
  doc.font("Helvetica-Bold").text(salary, { continued: true });
  doc.font("Helvetica").text(`, payable directly to your registered bank account.`);
  doc.moveDown(0.3);

  // Section 3 — OFFICE TIMINGS AND LEAVES (ALL CAPS heading per actual PDF)
  doc.font("Helvetica-Bold").text("3.", PAGE_MARGIN, doc.y, { continued: true, width: 20 });
  doc.text("  OFFICE TIMINGS AND LEAVES").font("Helvetica");
  doc.text(
    "Office timings will be 10:00 AM to 6:00 PM (WFH) with Sunday as weekly off. Leave must be informed at least one day in advance, subject to company policy.",
    bodyIndent,
    doc.y,
    { lineGap: LINE_GAP, width: bodyWidth },
  );
  doc.moveDown(0.3);

  // Section 4 — Terms & Conditions (title case per actual PDF)
  doc.font("Helvetica-Bold").text("4.", PAGE_MARGIN, doc.y, { continued: true, width: 20 });
  doc.text("  Terms & Conditions").font("Helvetica");
  doc.text(`You shall be on probation for a period of `, bodyIndent, doc.y, {
    continued: true,
    lineGap: LINE_GAP,
    width: bodyWidth,
  });
  doc.font("Helvetica-Bold").text(probation, { continued: true });
  doc
    .font("Helvetica")
    .text(
      ` from the date of joining, during which your performance and suitability for the position will be evaluated.`,
    );
  doc
    .font("Helvetica-Bold")
    .text(`Notice Period: `, bodyIndent, doc.y, { continued: true, width: bodyWidth });
  doc.text(notice).font("Helvetica");
  doc.moveDown(0.3);

  // Section 5 — Code of Conduct & Policies (title case per actual PDF)
  doc.font("Helvetica-Bold").text("5.", PAGE_MARGIN, doc.y, { continued: true, width: 20 });
  doc.text("  Code of Conduct & Policies").font("Helvetica");
  doc.text(
    "You are expected to comply with company policies, maintain discipline, safeguard confidential information, and uphold professionalism and ethical hiring practices at all times.",
    bodyIndent,
    doc.y,
    { lineGap: LINE_GAP, width: bodyWidth },
  );
  doc.moveDown(0.3);

  // Section 6 — Acknowledgment & Acceptance (title case per actual PDF)
  doc.font("Helvetica-Bold").text("6.", PAGE_MARGIN, doc.y, { continued: true, width: 20 });
  doc.text("  Acknowledgment & Acceptance").font("Helvetica");
  doc.text(
    "By signing below, the candidate confirms acceptance of all terms and conditions of this offer",
    bodyIndent,
    doc.y,
    { lineGap: LINE_GAP, width: bodyWidth },
  );
  doc.moveDown(0.5);

  // Welcome message
  doc
    .font("Helvetica-BoldOblique")
    .text(
      "We welcome you to the Opportunity Makers Group family and wish you success in your onboarding and future with us.",
      { lineGap: LINE_GAP },
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
      .text(`${label}: `, { continued: true })
      .font("Helvetica")
      .text(String(value), { lineGap: LINE_GAP });
  }
}
