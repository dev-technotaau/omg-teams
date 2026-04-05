import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import bcrypt from "bcryptjs";

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

  const platformSettings = [
    // Zone configuration
    { category: "zone", key: "zone_set_a", value: ["WEST", "CENTRAL"] },
    { category: "zone", key: "zone_set_b", value: ["EAST", "NORTH", "SOUTH"] },

    // Invoice
    { category: "invoice", key: "invoice_prefix", value: "INV" },
    { category: "invoice", key: "invoice_start_number", value: 1 },
    { category: "invoice", key: "invoice_date_format", value: "DD/MM/YYYY" },

    // Session & Security
    { category: "session", key: "session_timeout_minutes", value: 30 },
    { category: "session", key: "max_sessions_per_user", value: 5 },
    { category: "session", key: "account_lockout_threshold", value: 5 },
    { category: "session", key: "account_lockout_duration_minutes", value: 30 },

    // Archive & Trash
    { category: "archive", key: "auto_archive_months", value: 12 },
    { category: "trash", key: "auto_purge_days", value: 90 },

    // Upload limits
    { category: "upload", key: "upload_daily_limit_mb", value: 100 },
    { category: "upload", key: "max_file_size_mb", value: 25 },

    // Platform branding
    { category: "branding", key: "platform_name", value: "OMG Teams" },
    { category: "branding", key: "platform_tagline", value: "Recruitment & Workforce Management" },

    // Offer letter signatory defaults
    { category: "offer_letter", key: "offer_letter_signatory_name", value: "Admin" },
    { category: "offer_letter", key: "offer_letter_signatory_title", value: "HR Manager" },

    // Report defaults
    { category: "report", key: "report_default_schedule_time", value: "09:00" },
    { category: "report", key: "report_retention_days", value: 90 },

    // Notification defaults
    { category: "notification", key: "notification_retention_days", value: 30 },
    { category: "notification", key: "notification_max_per_page", value: 50 },

    // Maintenance mode (off by default)
    { category: "system", key: "maintenance_mode", value: false },
    { category: "system", key: "maintenance_message", value: "The platform is currently under maintenance. Please check back shortly." },
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

  type DropdownSeed = {
    category: "STATE" | "LOCATION" | "PROFILE" | "QUALIFICATION" | "NOTICE_PERIOD" | "DIPLOMA";
    value: string;
    label: string;
    zoneSet?: "SET_A" | "SET_B" | null;
    sortOrder: number;
  };

  const dropdownOptions: DropdownSeed[] = [
    // ── States ──
    { category: "STATE", value: "maharashtra", label: "Maharashtra", sortOrder: 1 },
    { category: "STATE", value: "delhi", label: "Delhi", sortOrder: 2 },
    { category: "STATE", value: "karnataka", label: "Karnataka", sortOrder: 3 },
    { category: "STATE", value: "tamil_nadu", label: "Tamil Nadu", sortOrder: 4 },
    { category: "STATE", value: "uttar_pradesh", label: "Uttar Pradesh", sortOrder: 5 },
    { category: "STATE", value: "gujarat", label: "Gujarat", sortOrder: 6 },
    { category: "STATE", value: "rajasthan", label: "Rajasthan", sortOrder: 7 },
    { category: "STATE", value: "west_bengal", label: "West Bengal", sortOrder: 8 },
    { category: "STATE", value: "telangana", label: "Telangana", sortOrder: 9 },
    { category: "STATE", value: "andhra_pradesh", label: "Andhra Pradesh", sortOrder: 10 },
    { category: "STATE", value: "madhya_pradesh", label: "Madhya Pradesh", sortOrder: 11 },
    { category: "STATE", value: "punjab", label: "Punjab", sortOrder: 12 },
    { category: "STATE", value: "haryana", label: "Haryana", sortOrder: 13 },
    { category: "STATE", value: "bihar", label: "Bihar", sortOrder: 14 },
    { category: "STATE", value: "kerala", label: "Kerala", sortOrder: 15 },

    // ── Locations (Zone Set A — West + Central) ──
    { category: "LOCATION", value: "mumbai", label: "Mumbai", zoneSet: "SET_A", sortOrder: 1 },
    { category: "LOCATION", value: "pune", label: "Pune", zoneSet: "SET_A", sortOrder: 2 },
    { category: "LOCATION", value: "ahmedabad", label: "Ahmedabad", zoneSet: "SET_A", sortOrder: 3 },
    { category: "LOCATION", value: "surat", label: "Surat", zoneSet: "SET_A", sortOrder: 4 },
    { category: "LOCATION", value: "nagpur", label: "Nagpur", zoneSet: "SET_A", sortOrder: 5 },
    { category: "LOCATION", value: "indore", label: "Indore", zoneSet: "SET_A", sortOrder: 6 },
    { category: "LOCATION", value: "bhopal", label: "Bhopal", zoneSet: "SET_A", sortOrder: 7 },

    // ── Locations (Zone Set B — East + North + South) ──
    { category: "LOCATION", value: "delhi", label: "Delhi", zoneSet: "SET_B", sortOrder: 1 },
    { category: "LOCATION", value: "bangalore", label: "Bangalore", zoneSet: "SET_B", sortOrder: 2 },
    { category: "LOCATION", value: "hyderabad", label: "Hyderabad", zoneSet: "SET_B", sortOrder: 3 },
    { category: "LOCATION", value: "chennai", label: "Chennai", zoneSet: "SET_B", sortOrder: 4 },
    { category: "LOCATION", value: "kolkata", label: "Kolkata", zoneSet: "SET_B", sortOrder: 5 },
    { category: "LOCATION", value: "lucknow", label: "Lucknow", zoneSet: "SET_B", sortOrder: 6 },
    { category: "LOCATION", value: "jaipur", label: "Jaipur", zoneSet: "SET_B", sortOrder: 7 },
    { category: "LOCATION", value: "chandigarh", label: "Chandigarh", zoneSet: "SET_B", sortOrder: 8 },

    // ── Profiles (Zone Set A) ──
    { category: "PROFILE", value: "sales_executive", label: "Sales Executive", zoneSet: "SET_A", sortOrder: 1 },
    { category: "PROFILE", value: "telecaller", label: "Telecaller", zoneSet: "SET_A", sortOrder: 2 },
    { category: "PROFILE", value: "business_development", label: "Business Development", zoneSet: "SET_A", sortOrder: 3 },
    { category: "PROFILE", value: "customer_service", label: "Customer Service", zoneSet: "SET_A", sortOrder: 4 },
    { category: "PROFILE", value: "back_office", label: "Back Office", zoneSet: "SET_A", sortOrder: 5 },

    // ── Profiles (Zone Set B) ──
    { category: "PROFILE", value: "sales_executive", label: "Sales Executive", zoneSet: "SET_B", sortOrder: 1 },
    { category: "PROFILE", value: "telecaller", label: "Telecaller", zoneSet: "SET_B", sortOrder: 2 },
    { category: "PROFILE", value: "field_executive", label: "Field Executive", zoneSet: "SET_B", sortOrder: 3 },
    { category: "PROFILE", value: "delivery_executive", label: "Delivery Executive", zoneSet: "SET_B", sortOrder: 4 },
    { category: "PROFILE", value: "warehouse", label: "Warehouse", zoneSet: "SET_B", sortOrder: 5 },
    { category: "PROFILE", value: "data_entry", label: "Data Entry Operator", zoneSet: "SET_B", sortOrder: 6 },

    // ── Higher Qualifications ──
    { category: "QUALIFICATION", value: "10th", label: "10th Pass", sortOrder: 1 },
    { category: "QUALIFICATION", value: "12th", label: "12th Pass", sortOrder: 2 },
    { category: "QUALIFICATION", value: "diploma", label: "Diploma", sortOrder: 3 },
    { category: "QUALIFICATION", value: "graduate", label: "Graduate", sortOrder: 4 },
    { category: "QUALIFICATION", value: "post_graduate", label: "Post Graduate", sortOrder: 5 },
    { category: "QUALIFICATION", value: "mba", label: "MBA", sortOrder: 6 },
    { category: "QUALIFICATION", value: "btech", label: "B.Tech / B.E.", sortOrder: 7 },
    { category: "QUALIFICATION", value: "other", label: "Other", sortOrder: 8 },

    // ── Notice Period ──
    { category: "NOTICE_PERIOD", value: "immediate", label: "Immediate", sortOrder: 1 },
    { category: "NOTICE_PERIOD", value: "7_days", label: "7 Days", sortOrder: 2 },
    { category: "NOTICE_PERIOD", value: "15_days", label: "15 Days", sortOrder: 3 },
    { category: "NOTICE_PERIOD", value: "30_days", label: "30 Days", sortOrder: 4 },
    { category: "NOTICE_PERIOD", value: "60_days", label: "60 Days", sortOrder: 5 },
    { category: "NOTICE_PERIOD", value: "90_days", label: "90 Days", sortOrder: 6 },
    { category: "NOTICE_PERIOD", value: "currently_serving", label: "Currently Serving", sortOrder: 7 },

    // ── Diploma (Part / Full) ──
    { category: "DIPLOMA", value: "part", label: "Diploma (Part)", sortOrder: 1 },
    { category: "DIPLOMA", value: "full", label: "Diploma (Full)", sortOrder: 2 },
    { category: "DIPLOMA", value: "na", label: "N/A", sortOrder: 3 },
  ];

  // Use createMany with skipDuplicates (nullable zoneSet makes upsert complex)
  const created = await prisma.dropdownOption.createMany({
    data: dropdownOptions.map((opt) => ({
      category: opt.category,
      value: opt.value,
      label: opt.label,
      zoneSet: opt.zoneSet ?? null,
      sortOrder: opt.sortOrder,
      isActive: true,
    })),
    skipDuplicates: true,
  });
  console.log(`  Dropdown Options: ${created.count} created (${dropdownOptions.length} total, duplicates skipped)`);

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
