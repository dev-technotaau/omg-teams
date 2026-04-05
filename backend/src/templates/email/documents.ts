import {
  type EmailTemplate,
  BRAND,
  emailLayout,
  heading,
  paragraph,
  greeting,
  button,
  successBox,
  dangerBox,
  infoBox,
  detailsTable,
  keyValue,
  signature,
} from "./_layout.js";

// ──────────────────────────────────────────────
//  Document / KYC Emails
// ──────────────────────────────────────────────

export const documentUploaded = (employeeName: string, documentType: string): EmailTemplate => ({
  subject: `${BRAND.name} — Document Uploaded: ${employeeName}`,
  html: emailLayout(
    `${heading("New Document Uploaded")}
    ${paragraph(`<strong>${employeeName}</strong> uploaded a new document for verification.`)}
    ${detailsTable(keyValue("Employee", employeeName) + keyValue("Document Type", documentType))}
    ${button("Review Document", BRAND.url + "/admin/documents")}
    ${signature()}`,
    `${employeeName} uploaded ${documentType}.`,
  ),
  text: `${employeeName} uploaded ${documentType}. Review at ${BRAND.url}/admin/documents`,
});

export const documentVerified = (userName: string, documentType: string): EmailTemplate => ({
  subject: `${BRAND.name} — Document Verified`,
  html: emailLayout(
    `${heading("Document Verified")}
    ${greeting(userName)}
    ${successBox(`Your <strong>${documentType}</strong> has been verified by Admin.`)}
    ${paragraph("You can check the status of all your documents on the My Documents page.")}
    ${button("View My Documents", BRAND.url + "/documents", "success")}
    ${signature()}`,
    `Your ${documentType} has been verified.`,
  ),
  text: `Hi ${userName}, your ${documentType} has been verified.`,
});

export const documentRejected = (
  userName: string,
  documentType: string,
  reason: string,
): EmailTemplate => ({
  subject: `${BRAND.name} — Document Rejected`,
  html: emailLayout(
    `${heading("Document Rejected")}
    ${greeting(userName)}
    ${dangerBox(`Your <strong>${documentType}</strong> has been rejected.`)}
    ${detailsTable(keyValue("Reason", reason))}
    ${paragraph("Please re-upload the correct document to complete your KYC verification.")}
    ${button("Re-upload Document", BRAND.url + "/documents", "danger")}
    ${signature()}`,
    `Your ${documentType} has been rejected. Reason: ${reason}`,
  ),
  text: `Hi ${userName}, your ${documentType} has been rejected. Reason: ${reason}. Please re-upload.`,
});

export const kycComplete = (userName: string): EmailTemplate => ({
  subject: `${BRAND.name} — KYC Complete`,
  html: emailLayout(
    `${heading("KYC Verification Complete")}
    ${greeting(userName)}
    ${successBox("Congratulations! All your documents have been verified. Your KYC is now complete.")}
    ${paragraph("Thank you for completing the verification process.")}
    ${signature()}`,
    "Your KYC is complete! All documents verified.",
  ),
  text: `Hi ${userName}, congratulations! Your KYC is complete — all documents verified.`,
});

export const kycReminder = (userName: string, pendingCount: number): EmailTemplate => ({
  subject: `${BRAND.name} — KYC Reminder`,
  html: emailLayout(
    `${heading("Document Upload Reminder")}
    ${greeting(userName)}
    ${infoBox(`You have <strong>${pendingCount}</strong> document(s) not yet uploaded. Please upload all required documents to complete your KYC.`)}
    ${button("Upload Documents", BRAND.url + "/documents")}
    ${signature()}`,
    `Reminder: ${pendingCount} document(s) still pending.`,
  ),
  text: `Hi ${userName}, you have ${pendingCount} document(s) not yet uploaded. Please complete your KYC at ${BRAND.url}/documents`,
});
