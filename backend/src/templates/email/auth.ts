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
  dangerBox,
  detailsTable,
  keyValue,
  signature,
} from "./_layout.js";

// ──────────────────────────────────────────────
//  Authentication & Account Emails
// ──────────────────────────────────────────────

export const accountCreated = (
  userName: string,
  employeeId: string,
  role: string,
  loginUrl: string,
): EmailTemplate => ({
  subject: `Welcome to ${BRAND.name} — Your Account Details`,
  html: emailLayout(
    `${heading("Welcome to " + BRAND.name + "!")}
    ${greeting(userName)}
    ${paragraph("Your account has been created successfully. Here are your details:")}
    ${detailsTable(
      keyValue(
        "Employee ID",
        `<code style="background:#f3f4f6;padding:2px 8px;border-radius:4px;">${employeeId}</code>`,
      ) +
        keyValue("Role", role) +
        keyValue("Platform", BRAND.name),
    )}
    ${paragraph("Please login with the credentials provided by your administrator.")}
    ${button("Login to " + BRAND.name, loginUrl)}
    ${infoBox("Your account is bound to the first device you login from. Contact admin if you need to change devices.")}
    ${signature()}`,
    `Welcome to ${BRAND.name}! Your account is ready.`,
  ),
  text: `Welcome to ${BRAND.name}, ${userName}! Your Employee ID is ${employeeId}. Role: ${role}. Login at ${loginUrl}`,
});

export const passwordReset = (userName: string): EmailTemplate => ({
  subject: `${BRAND.name} — Password Reset`,
  html: emailLayout(
    `${heading("Password Reset")}
    ${greeting(userName)}
    ${paragraph("Your password has been reset by the administrator. Please login with your new credentials.")}
    ${warningBox("If you did not request this change, contact your administrator immediately.")}
    ${button("Login Now", BRAND.url + "/login")}
    ${signature()}`,
    "Your password has been reset.",
  ),
  text: `Hi ${userName}, your password has been reset by the administrator. Please login with your new credentials at ${BRAND.url}/login`,
});

export const accountSuspended = (userName: string, reason?: string): EmailTemplate => ({
  subject: `${BRAND.name} — Account Suspended`,
  html: emailLayout(
    `${heading("Account Suspended")}
    ${greeting(userName)}
    ${paragraph("Your account has been suspended by the administrator.")}
    ${reason ? dangerBox(`Reason: ${reason}`) : ""}
    ${paragraph("You will not be able to access the platform until your account is reactivated. Please contact your administrator for assistance.")}
    ${signature()}`,
    "Your account has been suspended.",
  ),
  text: `Hi ${userName}, your account has been suspended.${reason ? ` Reason: ${reason}` : ""} Contact admin for assistance.`,
});

export const accountReactivated = (userName: string): EmailTemplate => ({
  subject: `${BRAND.name} — Account Reactivated`,
  html: emailLayout(
    `${heading("Account Reactivated")}
    ${greeting(userName)}
    ${paragraph("Your account has been reactivated. You can now login and access the platform.")}
    ${button("Login Now", BRAND.url + "/login", "success")}
    ${signature()}`,
    "Your account has been reactivated!",
  ),
  text: `Hi ${userName}, your account has been reactivated. Login at ${BRAND.url}/login`,
});

export const accountLockout = (
  userName: string,
  lockTimestamp: string,
  unlockTime: string,
): EmailTemplate => ({
  subject: `${BRAND.name} — Account Locked`,
  html: emailLayout(
    `${heading("Account Temporarily Locked")}
    ${greeting(userName)}
    ${paragraph("Your account has been temporarily locked due to multiple failed login attempts.")}
    ${detailsTable(keyValue("Locked at", lockTimestamp) + keyValue("Auto-unlock at", unlockTime))}
    ${warningBox("If this wasn't you, someone may be trying to access your account. Contact your administrator immediately.")}
    ${signature()}`,
    "Your account has been temporarily locked.",
  ),
  text: `Hi ${userName}, your account was locked at ${lockTimestamp} due to failed login attempts. It will unlock at ${unlockTime}.`,
});

export const deviceLockBlocked = (userName: string, deviceInfo?: string): EmailTemplate => ({
  subject: `${BRAND.name} — Login Blocked (Different Device)`,
  html: emailLayout(
    `${heading("Login Attempt Blocked")}
    ${greeting(userName)}
    ${paragraph("A login attempt was made from a device that doesn't match your registered device.")}
    ${deviceInfo ? infoBox(`Device: ${deviceInfo}`) : ""}
    ${dangerBox("Your account is bound to a specific device for security. Contact your administrator to reset your device binding if you need to use a different device.")}
    ${signature()}`,
    "A login attempt was blocked from an unrecognized device.",
  ),
  text: `Hi ${userName}, a login attempt was blocked from an unauthorized device. Contact admin to reset your device binding.`,
});

/**
 * Generic platform alert delivered to addresses in `notification_admin_emails`.
 * Used by the cross-cutting `notifyAdmins` helper to forward security/system
 * events to ops mailboxes that aren't tied to a user account.
 */
export const systemAlert = (
  title: string,
  message: string,
  actionUrl?: string | null,
): EmailTemplate => ({
  subject: `${BRAND.name} — ${title}`,
  html: emailLayout(
    `${heading(title)}
    ${paragraph(message)}
    ${actionUrl ? button("Open in " + BRAND.name, actionUrl) : ""}
    ${warningBox("This alert was sent to your address because it's listed in the platform's admin alert recipients. Manage recipients in Admin → Settings → Notifications.")}
    ${signature()}`,
    `${title}: ${message.slice(0, 120)}`,
  ),
  text: `${title}\n\n${message}${actionUrl ? `\n\nOpen: ${actionUrl}` : ""}`,
});
