import {
  LayoutDashboard,
  FileText,
  FilePlus,
  Users,
  Building2,
  BarChart3,
  ClipboardList,
  Calendar,
  CalendarDays,
  FolderOpen,
  Settings,
  Trash2,
  History,
  Target,
  Mail,
  ListChecks,
  Database,
  Shield,
  Copy,
  Upload,
  Monitor,
  Archive,
  FileSignature,
  FileCheck,
  Webhook,
  Activity,
  CheckSquare,
  Briefcase,
  UsersRound,
  FolderArchive,
  TrendingUp,
  LineChart,
  Wrench,
  Plug,
  ShieldCheck,
  SlidersHorizontal,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { ROLES } from "@/constants/roles";
import { ROUTES } from "@/constants/routes";

// ─────────────────────────────────────────────────────────────
//  Navigation config — single source of truth for the sidebar
//  AND the Cmd+K command palette. Anything you add here will
//  appear in both surfaces automatically (correctly grouped,
//  correctly role-filtered, and searchable by group name).
// ─────────────────────────────────────────────────────────────

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  roles: string[];
  /** Injected at render time — not part of the static config. */
  badge?: number;
  /** Extra fuzzy-match terms for the Cmd+K palette. The label + the group
   *  label are always searchable; `keywords` adds aliases on top (e.g.
   *  "schedule" / "shifts" for the attendance item). */
  keywords?: string[];
  /** Leader-key shortcut — pressed after `g`. Used by useLeaderKey to
   *  bind the route to a keystroke (e.g. `key: "d"` → `G D` opens this
   *  item). Same letter is fine across roles since bindings are
   *  filtered by role at registration time. */
  shortcut?: { key: string };
}

export interface NavGroup {
  label: string;
  icon: LucideIcon;
  children: NavItem[];
}

// ── Recruiter + RM flat nav (short enough to not need grouping) ──
export const NAV_ITEMS: NavItem[] = [
  // Recruiter & RM shared dashboard
  {
    label: "Dashboard",
    href: ROUTES.DASHBOARD,
    icon: LayoutDashboard,
    roles: [ROLES.RECRUITER, ROLES.REPORTING_MANAGER],
    shortcut: { key: "d" },
  },

  // Recruiter
  {
    label: "Add Report",
    href: ROUTES.REPORTS_NEW,
    icon: FilePlus,
    roles: [ROLES.RECRUITER],
    shortcut: { key: "c" },
  },
  {
    label: "My Reports",
    href: ROUTES.REPORTS,
    icon: FileText,
    roles: [ROLES.RECRUITER],
    shortcut: { key: "r" },
  },
  { label: "My Targets", href: ROUTES.MY_TARGETS, icon: Target, roles: [ROLES.RECRUITER] },
  {
    label: "My Tasks",
    href: ROUTES.MY_TASKS,
    icon: CheckSquare,
    roles: [ROLES.RECRUITER, ROLES.REPORTING_MANAGER],
    shortcut: { key: "t" },
  },

  // Reporting Manager
  {
    label: "My Recruiters",
    href: ROUTES.MY_RECRUITERS,
    icon: Users,
    roles: [ROLES.REPORTING_MANAGER],
    shortcut: { key: "m" },
  },
  {
    label: "Team Reports",
    href: ROUTES.REPORTS,
    icon: FileText,
    roles: [ROLES.REPORTING_MANAGER],
    shortcut: { key: "r" },
  },
  {
    label: "Team Attendance",
    href: ROUTES.TEAM_ATTENDANCE,
    icon: Calendar,
    roles: [ROLES.REPORTING_MANAGER],
    keywords: ["schedule", "calendar", "shifts", "team schedule"],
  },
  {
    label: "Team Leaves",
    href: ROUTES.TEAM_LEAVES,
    icon: CalendarDays,
    roles: [ROLES.REPORTING_MANAGER],
  },
  {
    label: "Team Targets",
    href: ROUTES.TEAM_TARGETS,
    icon: Target,
    roles: [ROLES.REPORTING_MANAGER],
  },

  // Common (Recruiter + RM)
  {
    label: "My Attendance",
    href: ROUTES.ATTENDANCE,
    icon: Calendar,
    roles: [ROLES.RECRUITER, ROLES.REPORTING_MANAGER],
    keywords: ["schedule", "calendar", "shifts", "punch in", "punch out"],
    shortcut: { key: "a" },
  },
  {
    label: "My Leaves",
    href: ROUTES.LEAVES,
    icon: CalendarDays,
    roles: [ROLES.RECRUITER, ROLES.REPORTING_MANAGER],
    shortcut: { key: "l" },
  },
  {
    label: "My Documents",
    href: ROUTES.DOCUMENTS,
    icon: FolderOpen,
    roles: [ROLES.RECRUITER, ROLES.REPORTING_MANAGER],
  },
];

// ── Admin: 3 pinned top-level + 9 collapsible groups ──
export const ADMIN_TOP_LEVEL: NavItem[] = [
  {
    label: "Dashboard",
    href: ROUTES.ADMIN_DASHBOARD,
    icon: LayoutDashboard,
    roles: [ROLES.ADMIN],
    shortcut: { key: "d" },
  },
  {
    label: "Candidate Reports",
    href: ROUTES.ADMIN_REPORTS,
    icon: ClipboardList,
    roles: [ROLES.ADMIN],
    shortcut: { key: "r" },
  },
  {
    label: "Reports Mgmt",
    href: ROUTES.ADMIN_REPORTS_MANAGEMENT,
    icon: FileText,
    roles: [ROLES.ADMIN],
    shortcut: { key: "m" },
  },
];

export const ADMIN_GROUPS: NavGroup[] = [
  {
    label: "Recruitment",
    icon: Briefcase,
    children: [
      { label: "Companies", href: ROUTES.ADMIN_COMPANIES, icon: Building2, roles: [ROLES.ADMIN] },
      {
        label: "Offer Letters",
        href: ROUTES.ADMIN_OFFER_LETTERS,
        icon: FileSignature,
        roles: [ROLES.ADMIN],
      },
      { label: "Duplicates", href: ROUTES.ADMIN_DUPLICATES, icon: Copy, roles: [ROLES.ADMIN] },
    ],
  },
  {
    label: "Workforce",
    icon: UsersRound,
    children: [
      {
        label: "Employees",
        href: ROUTES.ADMIN_EMPLOYEES,
        icon: Users,
        roles: [ROLES.ADMIN],
        shortcut: { key: "e" },
      },
      {
        label: "Attendance",
        href: ROUTES.ADMIN_ATTENDANCE,
        icon: Calendar,
        roles: [ROLES.ADMIN],
        keywords: ["schedule", "calendar", "shifts"],
        shortcut: { key: "a" },
      },
      {
        label: "Leave Mgmt",
        href: ROUTES.ADMIN_LEAVES,
        icon: CalendarDays,
        roles: [ROLES.ADMIN],
        shortcut: { key: "l" },
      },
    ],
  },
  {
    label: "Documents",
    icon: FolderArchive,
    children: [
      { label: "Documents", href: ROUTES.ADMIN_DOCUMENTS, icon: FolderOpen, roles: [ROLES.ADMIN] },
      {
        label: "Document Types",
        href: ROUTES.ADMIN_DOCUMENT_TYPES,
        icon: FileCheck,
        roles: [ROLES.ADMIN],
      },
    ],
  },
  {
    label: "Performance",
    icon: TrendingUp,
    children: [
      { label: "Targets", href: ROUTES.ADMIN_TARGETS, icon: Target, roles: [ROLES.ADMIN] },
      {
        label: "Tasks",
        href: ROUTES.ADMIN_TASKS,
        icon: CheckSquare,
        roles: [ROLES.ADMIN],
        shortcut: { key: "t" },
      },
    ],
  },
  {
    label: "Analytics",
    icon: LineChart,
    children: [
      { label: "Analytics", href: ROUTES.ADMIN_ANALYTICS, icon: BarChart3, roles: [ROLES.ADMIN] },
      { label: "Audit Log", href: ROUTES.ADMIN_AUDIT_LOGS, icon: History, roles: [ROLES.ADMIN] },
    ],
  },
  {
    label: "Configuration",
    icon: Wrench,
    children: [
      {
        label: "Master Data",
        href: ROUTES.ADMIN_MASTER_DATA,
        icon: Database,
        roles: [ROLES.ADMIN],
      },
      {
        label: "Email Templates",
        href: ROUTES.ADMIN_EMAIL_TEMPLATES,
        icon: Mail,
        roles: [ROLES.ADMIN],
      },
      { label: "Holidays", href: ROUTES.ADMIN_HOLIDAYS, icon: ListChecks, roles: [ROLES.ADMIN] },
    ],
  },
  {
    label: "Integrations",
    icon: Plug,
    children: [
      { label: "Import", href: ROUTES.ADMIN_IMPORT, icon: Upload, roles: [ROLES.ADMIN] },
      { label: "Webhooks", href: ROUTES.ADMIN_WEBHOOKS, icon: Webhook, roles: [ROLES.ADMIN] },
      { label: "Queues", href: ROUTES.ADMIN_QUEUES, icon: Activity, roles: [ROLES.ADMIN] },
    ],
  },
  {
    label: "Security",
    icon: ShieldCheck,
    children: [
      {
        label: "User Management",
        href: ROUTES.ADMIN_USERS,
        icon: Shield,
        roles: [ROLES.ADMIN],
        shortcut: { key: "u" },
      },
      { label: "Sessions", href: ROUTES.ADMIN_SESSIONS, icon: Monitor, roles: [ROLES.ADMIN] },
    ],
  },
  {
    label: "System",
    icon: SlidersHorizontal,
    children: [
      { label: "Settings", href: ROUTES.ADMIN_SETTINGS, icon: Settings, roles: [ROLES.ADMIN] },
      { label: "Trash", href: ROUTES.ADMIN_TRASH, icon: Trash2, roles: [ROLES.ADMIN] },
      { label: "Archive", href: ROUTES.ADMIN_ARCHIVE, icon: Archive, roles: [ROLES.ADMIN] },
    ],
  },
];

/** Flat list of every admin item (top-level + every group child).
 *  Used by collapsed-sidebar mode and as the source of truth when
 *  injecting badge counts onto specific items. */
export function flattenAdmin(): NavItem[] {
  return [...ADMIN_TOP_LEVEL, ...ADMIN_GROUPS.flatMap((g) => g.children)];
}

// ─────────────────────────────────────────────────────────────
//  Palette helpers — flatten the role-visible nav into searchable
//  groups for the Cmd+K palette. Group labels are injected into
//  each item's `keywords` so typing "recruitment" matches every
//  item in that group.
// ─────────────────────────────────────────────────────────────

export interface PaletteNavSection {
  /** Section heading shown in the palette. */
  label: string;
  /** Flat list of items in this section. */
  items: Array<NavItem & { groupLabel: string | null }>;
}

/**
 * Build the role-aware list of palette sections from the nav config.
 * Admin → 1 "Quick access" section (top-level) + 1 section per group.
 * Recruiter / RM → a single "Navigate" section.
 */
export function buildPaletteSections(role: string): PaletteNavSection[] {
  if (role === ROLES.ADMIN) {
    return [
      {
        label: "Quick access",
        items: ADMIN_TOP_LEVEL.map((item) => ({ ...item, groupLabel: null })),
      },
      ...ADMIN_GROUPS.map((group) => ({
        label: group.label,
        items: group.children.map((item) => ({ ...item, groupLabel: group.label })),
      })),
    ];
  }
  return [
    {
      label: "Navigate",
      items: NAV_ITEMS.filter((item) => item.roles.includes(role)).map((item) => ({
        ...item,
        groupLabel: null,
      })),
    },
  ];
}
