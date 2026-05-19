// ──────────────────────────────────────────────
//  Query Key Factory — single source of truth for every cache key
//
//  TanStack Query identifies cached data by an array key. To keep keys
//  consistent across the app, *every* query key in the codebase is built
//  from the constants in this file. That gives us:
//
//    1. Refactor safety — renaming a key in one place updates all callers.
//    2. Targeted invalidation — `qc.invalidateQueries({ queryKey: qk.holidays.lists() })`
//       blasts every paginated/filtered holiday list without touching detail
//       queries (or vice versa via `qk.holidays.details()`).
//    3. Compile-time guarantees — TypeScript catches typos at build time.
//
//  Convention (borrowed from TkDodo's "effective react query keys" essay):
//
//    - Resource root:        ['holidays']
//    - All lists:            ['holidays', 'list']
//    - Filtered list:        ['holidays', 'list', { year: 2026 }]
//    - All detail records:   ['holidays', 'detail']
//    - One detail:           ['holidays', 'detail', id]
//
//  When a mutation succeeds, invalidate at the level you care about. Most
//  list mutations want `qk.foo.lists()` (any filter/page combo).
// ──────────────────────────────────────────────

export const qk = {
  // ── Auth & current user ──
  me: () => ["me"] as const,

  // ── Holidays (§27.9) ──
  holidays: {
    all: () => ["holidays"] as const,
    lists: () => [...qk.holidays.all(), "list"] as const,
    list: (filters?: Record<string, unknown>) =>
      [...qk.holidays.lists(), filters ?? {}] as const,
  },

  // ── Document Types (§23.10) ──
  documentTypes: {
    all: () => ["document-types"] as const,
    lists: () => [...qk.documentTypes.all(), "list"] as const,
    list: (filters?: Record<string, unknown>) =>
      [...qk.documentTypes.lists(), filters ?? {}] as const,
  },

  // ── Companies (§9) ──
  companies: {
    all: () => ["companies"] as const,
    lists: () => [...qk.companies.all(), "list"] as const,
    list: (filters?: Record<string, unknown>) =>
      [...qk.companies.lists(), filters ?? {}] as const,
    details: () => [...qk.companies.all(), "detail"] as const,
    detail: (id: string) => [...qk.companies.details(), id] as const,
  },

  // ── Webhooks (§22.6) ──
  webhooks: {
    all: () => ["webhooks"] as const,
    lists: () => [...qk.webhooks.all(), "list"] as const,
    list: (filters?: Record<string, unknown>) =>
      [...qk.webhooks.lists(), filters ?? {}] as const,
  },

  // ── Offer Letters (§29.4) ──
  offerLetters: {
    all: () => ["offer-letters"] as const,
    lists: () => [...qk.offerLetters.all(), "list"] as const,
    list: (filters?: Record<string, unknown>) =>
      [...qk.offerLetters.lists(), filters ?? {}] as const,
    details: () => [...qk.offerLetters.all(), "detail"] as const,
    detail: (id: string) => [...qk.offerLetters.details(), id] as const,
  },

  // ── Employees / Users ──
  employees: {
    all: () => ["employees"] as const,
    lists: () => [...qk.employees.all(), "list"] as const,
    list: (filters?: Record<string, unknown>) =>
      [...qk.employees.lists(), filters ?? {}] as const,
    details: () => [...qk.employees.all(), "detail"] as const,
    detail: (id: string) => [...qk.employees.details(), id] as const,
  },
  users: {
    all: () => ["users"] as const,
    lists: () => [...qk.users.all(), "list"] as const,
    list: (filters?: Record<string, unknown>) =>
      [...qk.users.lists(), filters ?? {}] as const,
  },

  // ── Master Data (dropdown options, §23.19) ──
  masterData: {
    all: () => ["master-data"] as const,
    lists: () => [...qk.masterData.all(), "list"] as const,
    list: (category: string, filters?: Record<string, unknown>) =>
      [...qk.masterData.lists(), category, filters ?? {}] as const,
  },

  // ── Leaves (§7) ──
  leaves: {
    all: () => ["leaves"] as const,
    lists: () => [...qk.leaves.all(), "list"] as const,
    list: (filters?: Record<string, unknown>) =>
      [...qk.leaves.lists(), filters ?? {}] as const,
  },

  // ── Attendance (§8) ──
  attendance: {
    all: () => ["attendance"] as const,
    lists: () => [...qk.attendance.all(), "list"] as const,
    list: (filters?: Record<string, unknown>) =>
      [...qk.attendance.lists(), filters ?? {}] as const,
  },

  // ── Targets (§10) ──
  targets: {
    all: () => ["targets"] as const,
    lists: () => [...qk.targets.all(), "list"] as const,
    list: (filters?: Record<string, unknown>) =>
      [...qk.targets.lists(), filters ?? {}] as const,
  },

  // ── Tasks (§Task) ──
  tasks: {
    all: () => ["tasks"] as const,
    lists: () => [...qk.tasks.all(), "list"] as const,
    list: (filters?: Record<string, unknown>) =>
      [...qk.tasks.lists(), filters ?? {}] as const,
    details: () => [...qk.tasks.all(), "detail"] as const,
    detail: (id: string) => [...qk.tasks.details(), id] as const,
    stats: () => [...qk.tasks.all(), "stats"] as const,
    myList: (filters?: Record<string, unknown>) =>
      [...qk.tasks.all(), "me", "list", filters ?? {}] as const,
    myOpenCount: () => [...qk.tasks.all(), "me", "openCount"] as const,
    history: (id: string) => [...qk.tasks.all(), "history", id] as const,
    userMetrics: (userId: string) => [...qk.tasks.all(), "userMetrics", userId] as const,
  },

  // ── Documents (§6) ──
  documents: {
    all: () => ["documents"] as const,
    lists: () => [...qk.documents.all(), "list"] as const,
    list: (filters?: Record<string, unknown>) =>
      [...qk.documents.lists(), filters ?? {}] as const,
  },

  // ── Reports / Candidates (§5) ──
  reports: {
    all: () => ["reports"] as const,
    lists: () => [...qk.reports.all(), "list"] as const,
    list: (filters?: Record<string, unknown>) =>
      [...qk.reports.lists(), filters ?? {}] as const,
    details: () => [...qk.reports.all(), "detail"] as const,
    detail: (id: string) => [...qk.reports.details(), id] as const,
  },

  // ── Dashboards ──
  dashboard: {
    all: () => ["dashboard"] as const,
    admin: () => [...qk.dashboard.all(), "admin"] as const,
    user: () => [...qk.dashboard.all(), "user"] as const,
  },

  // ── Trash / Archive (§19, §20) ──
  trash: {
    all: () => ["trash"] as const,
    lists: () => [...qk.trash.all(), "list"] as const,
    list: (filters?: Record<string, unknown>) =>
      [...qk.trash.lists(), filters ?? {}] as const,
  },
  archive: {
    all: () => ["archive"] as const,
    lists: () => [...qk.archive.all(), "list"] as const,
    list: (filters?: Record<string, unknown>) =>
      [...qk.archive.lists(), filters ?? {}] as const,
  },

  // ── Audit log (§22) ──
  auditLog: {
    all: () => ["audit-log"] as const,
    lists: () => [...qk.auditLog.all(), "list"] as const,
    list: (filters?: Record<string, unknown>) =>
      [...qk.auditLog.lists(), filters ?? {}] as const,
  },

  // ── Settings (§23) ──
  settings: {
    all: () => ["settings"] as const,
    platform: () => [...qk.settings.all(), "platform"] as const,
  },

  // ── Notifications (§14) ──
  notifications: {
    all: () => ["notifications"] as const,
    lists: () => [...qk.notifications.all(), "list"] as const,
    list: (filters?: Record<string, unknown>) =>
      [...qk.notifications.lists(), filters ?? {}] as const,
    unreadCount: () => [...qk.notifications.all(), "unread-count"] as const,
  },

  // ── Recruiters / Targets (recruiter side) ──
  myRecruiters: {
    all: () => ["my-recruiters"] as const,
    lists: () => [...qk.myRecruiters.all(), "list"] as const,
    list: (filters?: Record<string, unknown>) =>
      [...qk.myRecruiters.lists(), filters ?? {}] as const,
    detail: (id: string) => [...qk.myRecruiters.all(), "detail", id] as const,
  },
  myTargets: {
    all: () => ["my-targets"] as const,
    lists: () => [...qk.myTargets.all(), "list"] as const,
    list: (filters?: Record<string, unknown>) =>
      [...qk.myTargets.lists(), filters ?? {}] as const,
  },

  // ── Duplicates (§5.4) ──
  duplicates: {
    all: () => ["duplicates"] as const,
    lists: () => [...qk.duplicates.all(), "list"] as const,
    list: (filters?: Record<string, unknown>) =>
      [...qk.duplicates.lists(), filters ?? {}] as const,
  },

  // ── Imports (§23.6) ──
  imports: {
    all: () => ["imports"] as const,
    lists: () => [...qk.imports.all(), "list"] as const,
    list: (filters?: Record<string, unknown>) =>
      [...qk.imports.lists(), filters ?? {}] as const,
  },

  // ── Reports management (admin scheduled reports, §11) ──
  queues: {
    all: () => ["queues"] as const,
    stats: () => [...qk.queues.all(), "stats"] as const,
  },
  emailTemplates: {
    all: () => ["email-templates"] as const,
    list: () => [...qk.emailTemplates.all(), "list"] as const,
    detail: (id: string) => [...qk.emailTemplates.all(), "detail", id] as const,
  },
  analytics: {
    all: () => ["analytics"] as const,
    section: (section: string, params?: Record<string, unknown>) =>
      [...qk.analytics.all(), section, params ?? {}] as const,
  },
  passkeys: {
    all: () => ["passkeys"] as const,
    list: () => [...qk.passkeys.all(), "list"] as const,
  },
  notifPrefs: {
    all: () => ["notif-prefs"] as const,
    detail: () => [...qk.notifPrefs.all(), "detail"] as const,
    quietHours: () => [...qk.notifPrefs.all(), "quiet-hours"] as const,
  },
  reportsManagement: {
    all: () => ["reports-management"] as const,
    lists: () => [...qk.reportsManagement.all(), "list"] as const,
    list: (filters?: Record<string, unknown>) =>
      [...qk.reportsManagement.lists(), filters ?? {}] as const,
    schedules: () => [...qk.reportsManagement.all(), "schedules"] as const,
    history: (filters?: Record<string, unknown>) =>
      [...qk.reportsManagement.all(), "history", filters ?? {}] as const,
    filterData: () => [...qk.reportsManagement.all(), "filter-data"] as const,
    columns: (reportType?: string) =>
      [...qk.reportsManagement.all(), "columns", reportType ?? "all"] as const,
    templates: (reportType?: string) =>
      [...qk.reportsManagement.all(), "templates", reportType ?? "all"] as const,
  },
} as const;
