"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { api } from "@/lib/api";
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
  ChevronLeft,
  ChevronRight,
  Copy,
  Upload,
  Monitor,
  Archive,
  FileSignature,
  FileCheck,
  Webhook,
  Activity,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useAuth } from "@/contexts/auth";
import { useUIStore } from "@/store/ui";
import { cn } from "@/lib/utils";
import { ROLES } from "@/constants/roles";
import { ROUTES } from "@/constants/routes";
import { useIsMobile } from "@/hooks";
import type { LucideIcon } from "lucide-react";

// ──────────────────────────────────────────────
//  Sidebar Navigation — Spec Section 18
//  Role-based menu, collapsible, active states
// ──────────────────────────────────────────────

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  roles: string[];
  badge?: number;
}

const NAV_ITEMS: NavItem[] = [
  // ── Recruiter & RM shared dashboard ──
  {
    label: "Dashboard",
    href: ROUTES.DASHBOARD,
    icon: LayoutDashboard,
    roles: [ROLES.RECRUITER, ROLES.REPORTING_MANAGER],
  },

  // ── Admin dashboard ──
  { label: "Dashboard", href: ROUTES.ADMIN_DASHBOARD, icon: LayoutDashboard, roles: [ROLES.ADMIN] },

  // ── Recruiter ──
  { label: "Add Report", href: ROUTES.REPORTS_NEW, icon: FilePlus, roles: [ROLES.RECRUITER] },
  { label: "My Reports", href: ROUTES.REPORTS, icon: FileText, roles: [ROLES.RECRUITER] },

  // ── Reporting Manager ──
  {
    label: "My Recruiters",
    href: ROUTES.MY_RECRUITERS,
    icon: Users,
    roles: [ROLES.REPORTING_MANAGER],
  },
  { label: "Team Reports", href: ROUTES.REPORTS, icon: FileText, roles: [ROLES.REPORTING_MANAGER] },
  {
    label: "Team Attendance",
    href: ROUTES.TEAM_ATTENDANCE,
    icon: Calendar,
    roles: [ROLES.REPORTING_MANAGER],
  },
  {
    label: "Team Leaves",
    href: ROUTES.TEAM_LEAVES,
    icon: CalendarDays,
    roles: [ROLES.REPORTING_MANAGER],
  },

  // ── Common (Recruiter + RM) ──
  {
    label: "My Attendance",
    href: ROUTES.ATTENDANCE,
    icon: Calendar,
    roles: [ROLES.RECRUITER, ROLES.REPORTING_MANAGER],
  },
  {
    label: "My Leaves",
    href: ROUTES.LEAVES,
    icon: CalendarDays,
    roles: [ROLES.RECRUITER, ROLES.REPORTING_MANAGER],
  },
  {
    label: "My Documents",
    href: ROUTES.DOCUMENTS,
    icon: FolderOpen,
    roles: [ROLES.RECRUITER, ROLES.REPORTING_MANAGER],
  },

  // ── Admin ──
  { label: "Employees", href: ROUTES.ADMIN_EMPLOYEES, icon: Users, roles: [ROLES.ADMIN] },
  { label: "User Management", href: ROUTES.ADMIN_USERS, icon: Shield, roles: [ROLES.ADMIN] },
  {
    label: "Candidate Reports",
    href: ROUTES.ADMIN_REPORTS,
    icon: ClipboardList,
    roles: [ROLES.ADMIN],
  },
  { label: "Companies", href: ROUTES.ADMIN_COMPANIES, icon: Building2, roles: [ROLES.ADMIN] },
  {
    label: "Reports Mgmt",
    href: ROUTES.ADMIN_REPORTS_MANAGEMENT,
    icon: FileText,
    roles: [ROLES.ADMIN],
  },
  { label: "Analytics", href: ROUTES.ADMIN_ANALYTICS, icon: BarChart3, roles: [ROLES.ADMIN] },
  { label: "Attendance", href: ROUTES.ADMIN_ATTENDANCE, icon: Calendar, roles: [ROLES.ADMIN] },
  { label: "Leave Mgmt", href: ROUTES.ADMIN_LEAVES, icon: CalendarDays, roles: [ROLES.ADMIN] },
  { label: "Documents", href: ROUTES.ADMIN_DOCUMENTS, icon: FolderOpen, roles: [ROLES.ADMIN] },
  {
    label: "Document Types",
    href: ROUTES.ADMIN_DOCUMENT_TYPES,
    icon: FileCheck,
    roles: [ROLES.ADMIN],
  },
  {
    label: "Offer Letters",
    href: ROUTES.ADMIN_OFFER_LETTERS,
    icon: FileSignature,
    roles: [ROLES.ADMIN],
  },
  { label: "Duplicates", href: ROUTES.ADMIN_DUPLICATES, icon: Copy, roles: [ROLES.ADMIN] },
  { label: "Targets", href: ROUTES.ADMIN_TARGETS, icon: Target, roles: [ROLES.ADMIN] },
  { label: "Import", href: ROUTES.ADMIN_IMPORT, icon: Upload, roles: [ROLES.ADMIN] },
  { label: "Sessions", href: ROUTES.ADMIN_SESSIONS, icon: Monitor, roles: [ROLES.ADMIN] },
  { label: "Audit Log", href: ROUTES.ADMIN_AUDIT_LOGS, icon: History, roles: [ROLES.ADMIN] },
  { label: "Trash", href: ROUTES.ADMIN_TRASH, icon: Trash2, roles: [ROLES.ADMIN] },
  { label: "Archive", href: ROUTES.ADMIN_ARCHIVE, icon: Archive, roles: [ROLES.ADMIN] },
  { label: "Master Data", href: ROUTES.ADMIN_MASTER_DATA, icon: Database, roles: [ROLES.ADMIN] },
  {
    label: "Email Templates",
    href: ROUTES.ADMIN_EMAIL_TEMPLATES,
    icon: Mail,
    roles: [ROLES.ADMIN],
  },
  { label: "Holidays", href: ROUTES.ADMIN_HOLIDAYS, icon: ListChecks, roles: [ROLES.ADMIN] },
  { label: "Webhooks", href: ROUTES.ADMIN_WEBHOOKS, icon: Webhook, roles: [ROLES.ADMIN] },
  { label: "Queues", href: ROUTES.ADMIN_QUEUES, icon: Activity, roles: [ROLES.ADMIN] },
  { label: "Settings", href: ROUTES.ADMIN_SETTINGS, icon: Settings, roles: [ROLES.ADMIN] },
];

export function Sidebar() {
  const pathname = usePathname();
  const { theme } = useTheme();
  const { user } = useAuth();
  const { sidebarOpen, toggleSidebar } = useUIStore();
  const isMobile = useIsMobile();
  const [pendingDocCount, setPendingDocCount] = useState(0);

  const role = user?.role ?? "";

  // §29.5.1 — Fetch pending document count for admin sidebar badge
  useEffect(() => {
    if (role !== "ADMIN") return;
    const fetchCount = async () => {
      try {
        const res = await api.get<{ pagination?: { total?: number } }>("/documents", {
          params: { status: "PENDING", limit: 1 },
        });
        setPendingDocCount(res.data.pagination?.total ?? 0);
      } catch {
        // non-critical
      }
    };
    void fetchCount();
    // Refresh every 2 minutes
    const interval = setInterval(() => void fetchCount(), 120_000);
    return () => clearInterval(interval);
  }, [role]);

  const filteredItems = NAV_ITEMS.filter((item) => item.roles.includes(role)).map((item) => {
    // Inject pending doc count badge on the admin Documents nav item
    if (item.href === ROUTES.ADMIN_DOCUMENTS && pendingDocCount > 0) {
      return { ...item, badge: pendingDocCount };
    }
    return item;
  });

  return (
    <>
      {/* Mobile overlay backdrop */}
      {isMobile && sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={toggleSidebar} />
      )}
      <aside
        data-tour="sidebar"
        className={cn(
          "border-border-default flex flex-col border-r transition-all duration-300",
          "bg-bg-sidebar text-text-sidebar",
          // Mobile: hidden by default, slide-in overlay when open
          isMobile
            ? cn(
                "fixed inset-y-0 left-0 z-50 w-60 -translate-x-full",
                sidebarOpen && "translate-x-0",
              )
            : sidebarOpen
              ? "w-60"
              : "w-16",
        )}
      >
        {/* Logo + Brand */}
        <div className="flex h-14 items-center justify-between border-b border-border-sidebar px-3">
          <Link href="/" className="min-w-0 flex-1 overflow-hidden">
            {sidebarOpen ? (
              /* Expanded: show full wide logo (emblem + company name + tagline) */
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={theme === "dark" ? "/icons/logo.png" : "/icons/logo-light-theme.png"}
                alt="OMG Teams"
                className="h-10 w-auto object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                  const fallback = (e.target as HTMLImageElement).nextElementSibling;
                  if (fallback) (fallback as HTMLElement).style.display = "block";
                }}
              />
            ) : (
              /* Collapsed: show square logo icon */
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={theme === "dark" ? "/icons/logo-collapsed.png" : "/icons/logo-collapsed-light-theme.png"}
                alt="OMG"
                className="h-8 w-8 object-contain"
              />
            )}
          </Link>
          <button
            onClick={toggleSidebar}
            className="text-text-sidebar hover:text-text-sidebar-active shrink-0 rounded-sm p-1 hover:bg-bg-hover"
          >
            {sidebarOpen ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
          </button>
        </div>

        {/* Nav Items */}
        <nav className="flex-1 overflow-y-auto py-2">
          {filteredItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                title={!sidebarOpen ? item.label : undefined}
                className={cn(
                  "mx-2 my-0.5 flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                  isActive
                    ? "bg-primary-500/20 text-text-sidebar-active font-medium"
                    : "text-text-sidebar hover:text-text-sidebar-active hover:bg-bg-hover",
                )}
              >
                <Icon size={18} className="shrink-0" />
                {sidebarOpen && <span className="flex-1 truncate">{item.label}</span>}
                {/* §29.5.1 — Pending count badge */}
                {item.badge != null && item.badge > 0 && (
                  <span className="bg-error-500 ml-auto inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-bold text-white">
                    {item.badge > 99 ? "99+" : item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* User info at bottom */}
        {sidebarOpen && user && (
          <div className="border-t border-border-sidebar p-4">
            <p className="text-text-sidebar truncate text-xs">{user.name}</p>
            <p className="text-text-muted truncate text-xs">{user.role.replace("_", " ")}</p>
          </div>
        )}
      </aside>
    </>
  );
}
