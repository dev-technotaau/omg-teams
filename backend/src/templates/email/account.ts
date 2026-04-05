import {
  type EmailTemplate,
  BRAND,
  emailLayout,
  heading,
  paragraph,
  greeting,
  button,
  infoBox,
  warningBox,
  detailsTable,
  keyValue,
  signature,
} from "./_layout.js";

// ──────────────────────────────────────────────
//  Account Management Emails
//  OTP verification, password change, email change
// ──────────────────────────────────────────────

export const emailChangeOtp = (userName: string, otp: string, newEmail: string): EmailTemplate => ({
  subject: `${BRAND.name} — Email Change Verification Code`,
  html: emailLayout(
    `${heading("Email Change Verification")}
    ${greeting(userName)}
    ${paragraph("You requested to change your email address. Use the verification code below to confirm this change:")}
    ${detailsTable(
      keyValue(
        "New Email",
        `<code style="background:#f3f4f6;padding:2px 8px;border-radius:4px;">${newEmail}</code>`,
      ) +
        keyValue(
          "Verification Code",
          `<span style="font-size:28px;font-weight:bold;letter-spacing:6px;color:${BRAND.primary};">${otp}</span>`,
        ),
    )}
    ${warningBox("This code expires in 10 minutes. If you did not request this change, ignore this email — your account is safe.")}
    ${paragraph("Do not share this code with anyone.")}
    ${signature()}`,
    "Your email change verification code.",
  ),
  text: `Hi ${userName}, your email change verification code is: ${otp}. New email: ${newEmail}. This code expires in 10 minutes.`,
});

export const emailChangeConfirmation = (
  userName: string,
  oldEmail: string,
  newEmail: string,
): EmailTemplate => ({
  subject: `${BRAND.name} — Email Address Changed`,
  html: emailLayout(
    `${heading("Email Address Changed")}
    ${greeting(userName)}
    ${paragraph("Your email address has been successfully changed.")}
    ${detailsTable(
      keyValue("Previous Email", oldEmail) + keyValue("New Email", `<strong>${newEmail}</strong>`),
    )}
    ${warningBox("If you did not make this change, contact your administrator immediately.")}
    ${signature()}`,
    "Your email address has been updated.",
  ),
  text: `Hi ${userName}, your email was changed from ${oldEmail} to ${newEmail}. If you didn't make this change, contact admin immediately.`,
});

export const passwordChangeConfirmation = (userName: string): EmailTemplate => ({
  subject: `${BRAND.name} — Password Changed`,
  html: emailLayout(
    `${heading("Password Changed")}
    ${greeting(userName)}
    ${paragraph("Your password has been successfully changed.")}
    ${infoBox("You changed your password just now. All other sessions have been terminated for security.")}
    ${warningBox("If you did not make this change, contact your administrator immediately to secure your account.")}
    ${button("Login Now", BRAND.url + "/login")}
    ${signature()}`,
    "Your password has been changed.",
  ),
  text: `Hi ${userName}, your password has been changed successfully. All other sessions have been terminated. If you didn't make this change, contact admin immediately.`,
});

export const profileUpdatedByAdmin = (userName: string, changedFields: string): EmailTemplate => ({
  subject: `${BRAND.name} — Your Profile Was Updated`,
  html: emailLayout(
    `${heading("Profile Updated")}
    ${greeting(userName)}
    ${paragraph("Your profile has been updated by an administrator.")}
    ${detailsTable(keyValue("Fields Changed", changedFields))}
    ${infoBox("If you have any questions about these changes, please contact your administrator.")}
    ${signature()}`,
    "Your profile has been updated by an administrator.",
  ),
  text: `Hi ${userName}, your profile was updated by an administrator. Changed fields: ${changedFields}. Contact admin if you have questions.`,
});

export const mobileChangeConfirmation = (userName: string, newMobile: string): EmailTemplate => ({
  subject: `${BRAND.name} — Mobile Number Updated`,
  html: emailLayout(
    `${heading("Mobile Number Updated")}
    ${greeting(userName)}
    ${paragraph("Your mobile number has been successfully updated.")}
    ${detailsTable(keyValue("New Mobile", newMobile))}
    ${warningBox("If you did not make this change, contact your administrator immediately.")}
    ${signature()}`,
    "Your mobile number has been updated.",
  ),
  text: `Hi ${userName}, your mobile number was updated to ${newMobile}. If you didn't make this change, contact admin immediately.`,
});
