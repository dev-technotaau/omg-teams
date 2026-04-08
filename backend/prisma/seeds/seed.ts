import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import bcrypt from "bcryptjs";
import { seedDropdownOptions } from "./dropdown-data.js";

const pool = new pg.Pool({ connectionString: process.env["DATABASE_URL"] });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main(): Promise<void> {
  console.log("Seeding database...\n");

  // ══════════════════════════════════════════════
  //  1. Admin Account
  // ══════════════════════════════════════════════

  const adminEmail = "omg.teams26@gmail.com";
  const adminPassword = "OMG@Teams/26/2002";
  const adminHash = await bcrypt.hash(adminPassword, 12);

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      passwordHash: adminHash,
      firstName: "OMG",
      lastName: "Teams",
      role: "ADMIN",
      status: "ACTIVE",
    },
    create: {
      email: adminEmail,
      passwordHash: adminHash,
      role: "ADMIN",
      firstName: "OMG",
      lastName: "Teams",
      status: "ACTIVE",
      mobileNumber: null,
      address: null,
    },
  });
  console.log(`  Admin: ${admin.email} (id: ${admin.id})`);

  // ══════════════════════════════════════════════
  //  2. Admin Notification Preferences (all enabled)
  // ══════════════════════════════════════════════

  const notificationCategories = [
    "DOCUMENT",
    "LEAVE",
    "ATTENDANCE",
    "RECRUITMENT",
    "ACCOUNT",
    "SYSTEM",
    "REPORT",
    "TARGET",
    "GENERAL",
  ] as const;

  for (const category of notificationCategories) {
    await prisma.notificationPreference.upsert({
      where: { userId_category: { userId: admin.id, category } },
      update: {},
      create: {
        userId: admin.id,
        category,
        isEnabled: true,
        emailEnabled: true,
        soundEnabled: true,
        browserPushEnabled: true,
      },
    });
  }
  console.log(`  Admin Notification Preferences: ${notificationCategories.length} categories`);

  // ══════════════════════════════════════════════
  //  3. Leave Types
  // ══════════════════════════════════════════════

  const leaveTypes = [
    { name: "Casual Leave", code: "CL", isPaid: true, maxConsecutiveDays: 3, advanceNoticeDays: 1 },
    { name: "Sick Leave", code: "SL", isPaid: true, requiresDocument: true, requiresDocumentAfterDays: 2, maxConsecutiveDays: 7 },
    { name: "Earned Leave", code: "EL", isPaid: true, advanceNoticeDays: 15, maxConsecutiveDays: 15 },
    { name: "Comp Off", code: "CO", isPaid: true, maxConsecutiveDays: 1 },
    { name: "Unpaid Leave", code: "UL", isPaid: false, maxConsecutiveDays: 30 },
    { name: "Maternity Leave", code: "ML", isPaid: true, maxConsecutiveDays: 180, advanceNoticeDays: 30 },
    { name: "Paternity Leave", code: "PL", isPaid: true, maxConsecutiveDays: 15, advanceNoticeDays: 15 },
  ];

  // Default annual quotas (not in schema — used for seeding leave balances below)
  const leaveQuotas: Record<string, number> = {
    CL: 12, SL: 12, EL: 15, CO: 0, UL: 0, ML: 180, PL: 15,
  };

  for (const lt of leaveTypes) {
    await prisma.leaveType.upsert({
      where: { code: lt.code },
      update: {},
      create: lt,
    });
  }
  console.log(`  Leave Types: ${leaveTypes.length} seeded`);

  // ══════════════════════════════════════════════
  //  4. Document Types
  // ══════════════════════════════════════════════

  const docTypes = [
    { name: "Aadhaar Card", code: "AADHAAR", acceptedFormats: ["pdf", "jpg", "png"], isRequired: true, sortOrder: 1 },
    { name: "PAN Card", code: "PAN", acceptedFormats: ["pdf", "jpg", "png"], isRequired: true, sortOrder: 2 },
    { name: "Resume / CV", code: "RESUME", acceptedFormats: ["pdf", "doc", "docx"], isRequired: true, sortOrder: 3 },
    { name: "Bank Account Details", code: "BANK", acceptedFormats: ["pdf", "jpg", "png"], isRequired: true, sortOrder: 4 },
    { name: "Offer Letter / Agreement", code: "OFFER_LETTER", acceptedFormats: ["pdf"], isRequired: true, sortOrder: 5 },
    { name: "10th Marksheet", code: "MARKSHEET_10", acceptedFormats: ["pdf", "jpg", "png"], isRequired: false, sortOrder: 6 },
    { name: "12th Marksheet", code: "MARKSHEET_12", acceptedFormats: ["pdf", "jpg", "png"], isRequired: false, sortOrder: 7 },
    { name: "Graduation Certificate", code: "GRADUATION", acceptedFormats: ["pdf", "jpg", "png"], isRequired: false, sortOrder: 8 },
    { name: "Passport Photo", code: "PHOTO", acceptedFormats: ["jpg", "png"], isRequired: false, sortOrder: 9 },
    { name: "Address Proof", code: "ADDRESS_PROOF", acceptedFormats: ["pdf", "jpg", "png"], isRequired: false, sortOrder: 10 },
  ];

  for (const dt of docTypes) {
    await prisma.documentType.upsert({
      where: { code: dt.code },
      update: {},
      create: dt,
    });
  }
  console.log(`  Document Types: ${docTypes.length} seeded`);

  // ══════════════════════════════════════════════
  //  5. Attendance Config
  // ══════════════════════════════════════════════

  const attendanceDefaults: Record<string, unknown> = {
    expected_login_time: "10:00",
    grace_period_minutes: 15,
    absent_threshold_time: "11:00",
    half_day_threshold_minutes: 240,
    break_deduction_minutes: 60,
    end_of_day_cutoff: "23:59",
    midnight_reset_time: "00:00",
    midnight_reset_enabled: true,
    working_days: ["MON", "TUE", "WED", "THU", "FRI", "SAT"],
    overtime_threshold_minutes: 540,
    min_working_minutes_for_present: 360,
    auto_half_day_enabled: true,
    late_alert_threshold: 3,
    excessive_late_threshold: 5,
    late_deduction_enabled: false,
    weekend_days: ["SUN"],
  };

  for (const [key, value] of Object.entries(attendanceDefaults)) {
    await prisma.attendanceConfig.upsert({
      where: { key },
      update: {},
      create: { key, value: JSON.parse(JSON.stringify(value)) as object },
    });
  }
  console.log(`  Attendance Config: ${Object.keys(attendanceDefaults).length} settings`);

  // ══════════════════════════════════════════════
  //  6. Platform Settings
  // ══════════════════════════════════════════════

  // IMPORTANT: every key here MUST match what the admin Settings page reads
  // (see frontend/.../admin/settings/page.tsx FIELD_DEFS) and what backend
  // services read via getSetting*() helpers. If you add a new setting, add
  // it here too — otherwise the field will appear empty in the UI even
  // though the code uses its hardcoded fallback.
  const platformSettings = [
    // ── Attendance ──
    { category: "attendance", key: "expected_login_time", value: "10:00" },
    { category: "attendance", key: "grace_period_minutes", value: 15 },
    { category: "attendance", key: "half_day_threshold_minutes", value: 240 },
    { category: "attendance", key: "working_days", value: "Mon,Tue,Wed,Thu,Fri,Sat" },
    { category: "attendance", key: "standard_day_minutes", value: 480 },
    { category: "attendance", key: "break_deduction_minutes", value: 60 },
    { category: "attendance", key: "excessive_late_threshold", value: 5 },

    // ── Leave ──
    { category: "leave", key: "leave_negative_balance", value: false },
    { category: "leave", key: "leave_low_balance_threshold", value: 2 },

    // ── Reports ──
    { category: "reports", key: "report_retention_days", value: 30 },
    { category: "reports", key: "report_default_schedule_time", value: "09:00" },

    // ── Invoice ──
    { category: "invoice", key: "invoice_prefix", value: "HF" },
    { category: "invoice", key: "invoice_date_format", value: "YYYY-MM-DD" },
    { category: "invoice", key: "invoice_starting_serial", value: 1 },

    // ── Data Management ──
    { category: "data", key: "archive_threshold_months", value: 12 },
    { category: "data", key: "trash_auto_purge_days", value: 90 },

    // ── Notifications ──
    { category: "notification", key: "notification_admin_emails", value: "" },
    { category: "notification", key: "notification_email_enabled", value: true },
    { category: "notification", key: "notification_device_mismatch", value: true },
    { category: "notification", key: "notification_suspicious_activity", value: true },

    // ── Offer Letter ──
    { category: "offer_letter", key: "offer_letter_signatory_name", value: "Shalini Singh" },
    { category: "offer_letter", key: "offer_letter_signatory_title", value: "HR Manager" },

    // ── Maintenance Mode (managed via the Maintenance tab, not FIELD_DEFS) ──
    { category: "system", key: "maintenance_mode", value: false },
    {
      category: "system",
      key: "maintenance_message",
      value: "The platform is currently under maintenance. Please check back shortly.",
    },
  ];

  for (const setting of platformSettings) {
    await prisma.platformSetting.upsert({
      where: { key: setting.key },
      update: {},
      create: {
        category: setting.category,
        key: setting.key,
        value: JSON.parse(JSON.stringify(setting.value)) as object,
        updatedBy: admin.id,
      },
    });
  }
  console.log(`  Platform Settings: ${platformSettings.length} seeded`);

  // ══════════════════════════════════════════════
  //  7. Default Dropdown Options (Master Data)
  // ══════════════════════════════════════════════

  // Dropdown master data (states/locations/profiles + the small flat lists)
  // lives in a shared module so the one-shot backfill script can reuse it
  // without copy-paste drift.
  await seedDropdownOptions(prisma);

  // ══════════════════════════════════════════════
  //  8. Default Holidays (India — Current Year)
  // ══════════════════════════════════════════════

  const currentYear = new Date().getFullYear();
  const holidays = [
    { date: `${currentYear}-01-26`, name: "Republic Day", type: "NATIONAL", isRecurring: true },
    { date: `${currentYear}-03-14`, name: "Holi", type: "NATIONAL", isRecurring: false },
    { date: `${currentYear}-04-14`, name: "Ambedkar Jayanti", type: "NATIONAL", isRecurring: true },
    { date: `${currentYear}-05-01`, name: "May Day", type: "NATIONAL", isRecurring: true },
    { date: `${currentYear}-08-15`, name: "Independence Day", type: "NATIONAL", isRecurring: true },
    { date: `${currentYear}-10-02`, name: "Gandhi Jayanti", type: "NATIONAL", isRecurring: true },
    { date: `${currentYear}-10-20`, name: "Diwali", type: "NATIONAL", isRecurring: false },
    { date: `${currentYear}-11-01`, name: "Diwali (Day 2)", type: "NATIONAL", isRecurring: false },
    { date: `${currentYear}-12-25`, name: "Christmas", type: "NATIONAL", isRecurring: true },
  ];

  for (const h of holidays) {
    await prisma.holiday.upsert({
      where: { date: new Date(h.date) },
      update: {},
      create: {
        date: new Date(h.date),
        name: h.name,
        type: h.type,
        isRecurring: h.isRecurring,
        createdBy: admin.id,
      },
    });
  }
  console.log(`  Holidays: ${holidays.length} seeded for ${currentYear}`);

  // ══════════════════════════════════════════════
  //  9. Admin Leave Balances (current year)
  // ══════════════════════════════════════════════

  const allLeaveTypes = await prisma.leaveType.findMany();
  let balanceCount = 0;
  for (const lt of allLeaveTypes) {
    const quota = leaveQuotas[lt.code] ?? 0;
    if (quota > 0) {
      await prisma.leaveBalance.upsert({
        where: {
          userId_leaveTypeId_year: {
            userId: admin.id,
            leaveTypeId: lt.id,
            year: currentYear,
          },
        },
        update: {},
        create: {
          userId: admin.id,
          leaveTypeId: lt.id,
          year: currentYear,
          totalAllotted: quota,
          used: 0,
          remaining: quota,
        },
      });
      balanceCount++;
    }
  }
  console.log(`  Admin Leave Balances: ${balanceCount} types for ${currentYear}`);

  // ══════════════════════════════════════════════
  //  Done
  // ══════════════════════════════════════════════

  console.log("\n  Seed complete.");
  console.log(`  Admin login: ${adminEmail}`);
}

main()
  .catch((e: unknown) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
