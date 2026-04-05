// ============================================================
// Shared Email Layout & Design System — OMG Teams
// Enterprise-grade, email-client-compatible HTML email templates
// ============================================================

import { env } from "../../config/env.js";

export interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

const BRAND = {
  name: "OMG Teams",
  companyName: "Opportunity Makers Group",
  tagline: "You dream it, we make it.",
  primary: "#DAA025",
  primaryDark: "#B8861F",
  secondary: "#001845",
  secondaryDark: "#001030",
  success: "#059669",
  successLight: "#ecfdf5",
  warning: "#D97706",
  warningLight: "#fffbeb",
  error: "#DC2626",
  errorLight: "#fef2f2",
  info: "#2563EB",
  infoLight: "#eff6ff",
  text: "#1f2937",
  textSecondary: "#6b7280",
  textMuted: "#9ca3af",
  border: "#e5e7eb",
  bgPage: "#f3f4f6",
  bgCard: "#ffffff",
  url: env.FRONTEND_URL,
  get logoUrl() {
    return `${this.url}/icons/logo.png`;
  },
  supportEmail: "info@opportunitymakers.in",
  address: "302-Village Dhogri Road, Tehsil Nangal Salempur-1, Jalandhar, Punjab 144004",
  website: "www.opportunitymakers.in",
  year: new Date().getFullYear(),
};

export { BRAND };

// ── Core Layout ──

export const emailLayout = (content: string, preheader?: string): string => `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="x-apple-disable-message-reformatting">
  <meta name="format-detection" content="telephone=no,address=no,email=no,date=no,url=no">
  <title>${BRAND.name}</title>
  <!--[if mso]>
  <noscript><xml><o:OfficeDocumentSettings><o:AllowPNG/><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
  <style>table{border-collapse:collapse;}td,th{mso-line-height-rule:exactly;}</style>
  <![endif]-->
  <style>
    @media only screen and (max-width: 620px) {
      .email-container { width: 100% !important; max-width: 100% !important; }
      .email-content { padding: 24px 20px !important; }
      .stack-column { display: block !important; width: 100% !important; }
    }
    a { color: ${BRAND.primary}; }
    a:hover { color: ${BRAND.primaryDark}; }
  </style>
</head>
<body style="margin:0;padding:0;word-spacing:normal;background-color:${BRAND.bgPage};font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  ${preheader ? `<div style="display:none;font-size:1px;color:${BRAND.bgPage};line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">${preheader}${"&zwnj;&nbsp;".repeat(30)}</div>` : ""}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${BRAND.bgPage};">
    <tr>
      <td align="center" valign="top" style="padding:48px 16px;">
        <!--[if mso]><table role="presentation" align="center" width="600" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
        <!-- Logo Header -->
        <table role="presentation" class="email-container" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">
          <tr>
            <td style="text-align:center;padding:0 0 32px 0;">
              <a href="${BRAND.url}" style="text-decoration:none;display:inline-block;">
                <!--[if !mso]><!-->
                <img src="${BRAND.logoUrl}" alt="${BRAND.companyName}" width="280" style="max-width:280px;height:auto;display:block;margin:0 auto;border:0;" />
                <!--<![endif]-->
                <!--[if mso]>
                <span style="font-size:22px;font-weight:800;color:${BRAND.secondary};">${BRAND.companyName}</span>
                <![endif]-->
              </a>
            </td>
          </tr>
        </table>
        <!-- Content Card -->
        <table role="presentation" class="email-container" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background-color:${BRAND.bgCard};border-radius:12px;overflow:hidden;border:1px solid ${BRAND.border};">
          <tr>
            <td class="email-content" style="padding:40px 48px 36px 48px;">
              ${content}
            </td>
          </tr>
        </table>
        <!-- Footer -->
        <table role="presentation" class="email-container" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">
          <tr>
            <td style="padding:28px 48px;text-align:center;">
              <p style="margin:0 0 8px 0;font-size:13px;line-height:1.5;color:${BRAND.textMuted};">
                &copy; ${BRAND.year} ${BRAND.companyName}. All rights reserved.
              </p>
              <p style="margin:0 0 8px 0;font-size:12px;line-height:1.5;color:${BRAND.textMuted};">
                ${BRAND.address}
              </p>
              <p style="margin:0;font-size:12px;line-height:1.5;color:${BRAND.textMuted};">
                <a href="mailto:${BRAND.supportEmail}" style="color:${BRAND.textSecondary};text-decoration:underline;">${BRAND.supportEmail}</a>
                &nbsp;&middot;&nbsp;
                <a href="https://${BRAND.website}" style="color:${BRAND.textSecondary};text-decoration:underline;">${BRAND.website}</a>
              </p>
            </td>
          </tr>
        </table>
        <!--[if mso]></td></tr></table><![endif]-->
      </td>
    </tr>
  </table>
</body>
</html>`;

// ── Reusable Components ──

export const heading = (text: string): string =>
  `<h1 style="margin:0 0 8px 0;font-size:24px;font-weight:700;color:${BRAND.text};line-height:1.35;">${text}</h1>`;

export const subheading = (text: string): string =>
  `<h2 style="margin:0 0 6px 0;font-size:18px;font-weight:600;color:${BRAND.text};line-height:1.4;">${text}</h2>`;

export const paragraph = (text: string): string =>
  `<p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:${BRAND.text};">${text}</p>`;

export const greeting = (name: string): string => paragraph(`Hi ${name},`);

export const smallText = (text: string): string =>
  `<p style="margin:0 0 12px 0;font-size:13px;line-height:1.5;color:${BRAND.textSecondary};">${text}</p>`;

export const divider = (): string =>
  `<hr style="margin:24px 0;border:none;border-top:1px solid ${BRAND.border};" />`;

export const button = (
  text: string,
  url: string,
  variant: "primary" | "secondary" | "success" | "danger" = "primary",
): string => {
  const colors = {
    primary: { bg: BRAND.primary, hover: BRAND.primaryDark },
    secondary: { bg: BRAND.secondary, hover: BRAND.secondaryDark },
    success: { bg: BRAND.success, hover: "#047857" },
    danger: { bg: BRAND.error, hover: "#B91C1C" },
  };
  const c = colors[variant];
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;">
    <tr>
      <td style="border-radius:8px;background-color:${c.bg};">
        <a href="${url}" target="_blank" style="display:inline-block;padding:12px 28px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">${text}</a>
      </td>
    </tr>
  </table>`;
};

export const infoBox = (text: string): string =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:16px 0;">
    <tr>
      <td style="padding:14px 18px;background-color:${BRAND.infoLight};border-radius:8px;border-left:4px solid ${BRAND.info};">
        <p style="margin:0;font-size:14px;line-height:1.5;color:${BRAND.text};">${text}</p>
      </td>
    </tr>
  </table>`;

export const successBox = (text: string): string =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:16px 0;">
    <tr>
      <td style="padding:14px 18px;background-color:${BRAND.successLight};border-radius:8px;border-left:4px solid ${BRAND.success};">
        <p style="margin:0;font-size:14px;line-height:1.5;color:${BRAND.text};">${text}</p>
      </td>
    </tr>
  </table>`;

export const warningBox = (text: string): string =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:16px 0;">
    <tr>
      <td style="padding:14px 18px;background-color:${BRAND.warningLight};border-radius:8px;border-left:4px solid ${BRAND.warning};">
        <p style="margin:0;font-size:14px;line-height:1.5;color:${BRAND.text};">${text}</p>
      </td>
    </tr>
  </table>`;

export const dangerBox = (text: string): string =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:16px 0;">
    <tr>
      <td style="padding:14px 18px;background-color:${BRAND.errorLight};border-radius:8px;border-left:4px solid ${BRAND.error};">
        <p style="margin:0;font-size:14px;line-height:1.5;color:${BRAND.text};">${text}</p>
      </td>
    </tr>
  </table>`;

export const keyValue = (label: string, value: string): string =>
  `<tr>
    <td style="padding:6px 0;font-size:14px;color:${BRAND.textSecondary};width:140px;vertical-align:top;">${label}</td>
    <td style="padding:6px 0;font-size:14px;font-weight:600;color:${BRAND.text};">${value}</td>
  </tr>`;

export const detailsTable = (rows: string): string =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:16px 0;">
    ${rows}
  </table>`;

export const signature = (): string =>
  `${divider()}
  <p style="margin:0;font-size:14px;color:${BRAND.textSecondary};">Best regards,</p>
  <p style="margin:4px 0 0 0;font-size:14px;font-weight:600;color:${BRAND.text};">${BRAND.name} Team</p>`;
