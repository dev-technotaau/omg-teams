"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { api } from "@/lib/api";
import { ChevronLeft, ChevronDown } from "lucide-react";
import { useTheme } from "next-themes";
import { useAuth } from "@/contexts/auth";
import { useUIStore } from "@/store/ui";
import { cn } from "@/lib/utils";
import { ROLES } from "@/constants/roles";
import { ROUTES } from "@/constants/routes";
import { useIsMobile } from "@/hooks";
import {
  NAV_ITEMS,
  ADMIN_TOP_LEVEL,
  ADMIN_GROUPS,
  flattenAdmin,
  type NavItem,
  type NavGroup,
} from "@/lib/nav-config";

// ──────────────────────────────────────────────
//  Sidebar Navigation — Spec Section 18
//  Role-based menu, collapsible, active states.
//  Nav data lives in `@/lib/nav-config` so the sidebar + the Cmd+K
//  command palette share a single source of truth.
// ──────────────────────────────────────────────

/** sessionStorage key for the sidebar nav scroll position. Sidebar is
 *  one global widget so a single key (not per-pathname) is correct. */
const SIDEBAR_SCROLL_KEY = "omg.sidebar.scrollTop";

/** localStorage key for which admin sidebar groups are expanded.
 *  Persists across reloads so admins don't have to re-open their
 *  preferred sections every visit. */
const SIDEBAR_OPEN_GROUPS_KEY = "omg.sidebar.openGroups";

/**
 * Admin nav group section — collapsible header + indented children
 * with rounded tree connectors AND a hover-trace effect.
 *
 * Hover behaviour:
 *   - When the user hovers child N, the wire is highlighted in
 *     brand-primary from the top of the group down to and including
 *     child N's L-corner. Children below stay default-coloured.
 *   - Moving to a different child re-traces the path smoothly
 *     (CSS color transition on the pseudo-element borders).
 *   - Leaving the children block clears the hover state and the wire
 *     fades back to default.
 *   - The active child's `::before` is independently primary, so it
 *     remains highlighted regardless of hover.
 *
 * Implementation notes:
 *   - Per-group local state (one `hoveredIndex`) so hovering one
 *     group doesn't affect another.
 *   - `::before` and `::after` get `transition-colors duration-200`
 *     so the colour swap eases in/out.
 */
function NavGroupSection({
  group,
  items,
  isOpen,
  isActiveGroup,
  onToggle,
  isPathActive,
  onNavigate,
}: {
  group: NavGroup;
  items: NavItem[];
  isOpen: boolean;
  isActiveGroup: boolean;
  onToggle: () => void;
  isPathActive: (href: string) => boolean;
  onNavigate: () => void;
}) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const activeIndex = items.findIndex((c) => isPathActive(c.href));
  const GroupIcon = group.icon;

  // ── Trace endpoint (the lowest lit child index) ──
  // Two anchors can light the trace: transient hover + sticky active.
  // Whichever is further wins, so hovering BELOW active extends; hovering
  // ABOVE active doesn't shrink it.
  const hoverIdx = hoveredIndex ?? -1;
  const pathEnd = Math.max(hoverIdx, activeIndex);

  // ── Directional stagger ──
  // To make the wire feel like a liquid filling top-down (when growing)
  // and draining bottom-up (when shrinking), we apply a per-child
  // `transition-delay` derived from the previous vs current pathEnd:
  //   - Growing: newly-lit children get delays 0, S, 2S, … from the top
  //   - Shrinking: newly-unlit children get delays such that the bottom
  //     drains first (the topmost newly-default child waits longest)
  // Per-child delay is applied to the ::before/::after via a CSS custom
  // property (--trace-delay) read by Tailwind arbitrary-value classes.
  // Canonical usePrevious pattern. The ref holds the previous pathEnd so we
  // can compare against the new value and decide which children are newly
  // lit vs newly unlit. The ref is read once at the top of render, the
  // delay array is computed below, then the ref is updated in an effect
  // post-commit. The result is direction-aware staggered delays:
  //   - Growing: newly lit children get ascending delays from the top.
  //   - Shrinking: newly unlit children get delays so the bottom drains
  //     first (top-most newly-default child waits the longest).
  const prevPathEndRef = useRef(pathEnd);
  const STAGGER_MS = 70;
  // eslint-disable-next-line react-hooks/refs
  const delays = items.map((_, index) => {
    const prev = prevPathEndRef.current;
    if (pathEnd > prev) {
      if (index > prev && index <= pathEnd) return (index - prev - 1) * STAGGER_MS;
    } else if (pathEnd < prev) {
      if (index > pathEnd && index <= prev) return (prev - index) * STAGGER_MS;
    }
    return 0;
  });
  useEffect(() => {
    prevPathEndRef.current = pathEnd;
  }, [pathEnd]);

  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        className={cn(
          "mx-2 my-1 flex w-[calc(100%-1rem)] items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors",
          isActiveGroup
            ? "text-text-sidebar-active font-medium"
            : "text-text-sidebar hover:text-text-sidebar-active hover:bg-bg-hover",
        )}
      >
        <GroupIcon size={18} className="shrink-0" />
        <span className="flex-1 truncate text-left">{group.label}</span>
        <ChevronDown
          size={16}
          className={cn("shrink-0 transition-transform", isOpen && "rotate-180")}
        />
      </button>
      {isOpen && (
        <div
          className="relative mx-2 mb-1 pl-5"
          onMouseLeave={() => setHoveredIndex(null)}
        >
          {items.map((child, index) => {
            const isActive = index === activeIndex;
            const beforeHighlight = pathEnd >= 0 && index <= pathEnd;
            const afterHighlight = pathEnd >= 0 && index < pathEnd;
            const Icon = child.icon;
            return (
              <Link
                key={child.href}
                href={child.href}
                onMouseEnter={() => setHoveredIndex(index)}
                onClick={onNavigate}
                style={
                  {
                    "--trace-delay": `${delays[index] ?? 0}ms`,
                  } as React.CSSProperties
                }
                className={cn(
                  "group/child relative my-0.5 ml-3 flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm transition-colors",
                  // L-piece (top half) with rounded corner + horizontal tick.
                  // Per-child --trace-delay drives the staggered fill/drain.
                  "before:absolute before:-left-3 before:top-0 before:h-1/2 before:w-3 before:rounded-bl-md before:border-b before:border-l before:transition-colors before:duration-200 before:delay-(--trace-delay,0ms)",
                  // Continuation (lower half) — extended 2px past the bottom
                  // edge of the row into the inter-row margin so successive
                  // children's lines join with no visible gap. The last
                  // child has no ::after, so the trace ends cleanly there.
                  "after:absolute after:-left-3 after:top-1/2 after:-bottom-0.5 after:w-3 after:border-l after:transition-colors after:duration-200 after:delay-(--trace-delay,0ms) last:after:content-none",
                  beforeHighlight
                    ? "before:border-primary-500"
                    : "before:border-border-default",
                  afterHighlight
                    ? "after:border-primary-500"
                    : "after:border-border-default",
                  isActive
                    ? "bg-primary-500/20 text-text-sidebar-active font-medium"
                    : "text-text-sidebar hover:text-text-sidebar-active hover:bg-bg-hover",
                )}
              >
                <Icon size={14} className="shrink-0" />
                <span className="flex-1 truncate">{child.label}</span>
                {child.badge != null && child.badge > 0 && (
                  <span className="bg-error-500 ml-auto inline-flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] font-bold text-white">
                    {child.badge > 99 ? "99+" : child.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Single nav row — used by every render branch (admin top-level,
 *  admin grouped children render their own variant below, recruiter/RM
 *  flat, and the collapsed icon rail). */
function SidebarLink({
  item,
  isActive,
  expanded,
  onNavigate,
}: {
  item: NavItem;
  isActive: boolean;
  expanded: boolean;
  onNavigate: () => void;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      title={!expanded ? item.label : undefined}
      className={cn(
        "mx-2 my-1 flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors",
        isActive
          ? "bg-primary-500/20 text-text-sidebar-active font-medium"
          : "text-text-sidebar hover:text-text-sidebar-active hover:bg-bg-hover",
      )}
    >
      <Icon size={18} className="shrink-0" />
      {expanded && <span className="flex-1 truncate">{item.label}</span>}
      {item.badge != null && item.badge > 0 && (
        <span className="bg-error-500 ml-auto inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-bold text-white">
          {item.badge > 99 ? "99+" : item.badge}
        </span>
      )}
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // reason: legitimate hydration pattern — flip mount flag once on client
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);
  const isDark = mounted && resolvedTheme === "dark";
  const { user } = useAuth();
  const { sidebarOpen, toggleSidebar } = useUIStore();
  const isMobile = useIsMobile();
  const [pendingDocCount, setPendingDocCount] = useState(0);
  // §Task — sidebar badges
  // For recruiter/RM: open task count (PENDING + REJECTED awaiting resubmit)
  // For admin: count of submissions awaiting review
  const [openTaskCount, setOpenTaskCount] = useState(0);
  const [reviewTaskCount, setReviewTaskCount] = useState(0);

  // ── Persist + restore the scroll position of the nav list ──
  // Browser-native scroll restoration only works on body/html scroll,
  // not on inner containers, so the sidebar nav (which is what holds
  // the long list of links like Settings) loses its position on every
  // reload. We persist the scrollTop in sessionStorage and restore on
  // mount so the active link stays in view across reloads.
  const navRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    try {
      const saved = sessionStorage.getItem(SIDEBAR_SCROLL_KEY);
      if (saved) nav.scrollTop = Number(saved);
    } catch {
      /* sessionStorage may be unavailable in private mode — ignore */
    }
    let raf = 0;
    const handler = () => {
      // rAF-throttle the writes — scroll fires 60+ times per second
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        try {
          sessionStorage.setItem(SIDEBAR_SCROLL_KEY, String(nav.scrollTop));
        } catch {
          /* ignore */
        }
      });
    };
    nav.addEventListener("scroll", handler, { passive: true });
    return () => {
      nav.removeEventListener("scroll", handler);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

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

  // §Task — Recruiter / RM open task count (drives "My Tasks" badge)
  useEffect(() => {
    if (role !== "RECRUITER" && role !== "REPORTING_MANAGER") return;
    const fetchCount = async () => {
      try {
        const res = await api.get<{ data: { count: number } }>("/tasks/me/open-count");
        setOpenTaskCount(res.data.data.count);
      } catch {
        // non-critical
      }
    };
    void fetchCount();
    const interval = setInterval(() => void fetchCount(), 60_000);
    return () => clearInterval(interval);
  }, [role]);

  // §Task — Admin awaiting-review count (drives "Tasks" badge in admin)
  useEffect(() => {
    if (role !== "ADMIN") return;
    const fetchCount = async () => {
      try {
        const res = await api.get<{ data: { awaitingReview: number } }>("/tasks/stats");
        setReviewTaskCount(res.data.data.awaitingReview);
      } catch {
        // non-critical
      }
    };
    void fetchCount();
    const interval = setInterval(() => void fetchCount(), 60_000);
    return () => clearInterval(interval);
  }, [role]);

  // Centralised badge injection — applied wherever a NavItem is rendered
  // (admin grouped, admin flat in collapsed mode, recruiter/RM flat) so we
  // don't have to remember to repeat the conditions per render branch.
  const withBadge = (item: NavItem): NavItem => {
    if (item.href === ROUTES.ADMIN_DOCUMENTS && pendingDocCount > 0) {
      return { ...item, badge: pendingDocCount };
    }
    if (item.href === ROUTES.MY_TASKS && openTaskCount > 0) {
      return { ...item, badge: openTaskCount };
    }
    if (item.href === ROUTES.ADMIN_TASKS && reviewTaskCount > 0) {
      return { ...item, badge: reviewTaskCount };
    }
    return item;
  };

  const isAdmin = role === ROLES.ADMIN;

  // Recruiter / RM list (also used as the admin "flat" list when the sidebar
  // is collapsed so every link is still one click away from the rail).
  const flatItems = isAdmin
    ? flattenAdmin().map(withBadge)
    : NAV_ITEMS.filter((item) => item.roles.includes(role)).map(withBadge);

  // ── Admin-only: collapsible groups ──
  // openGroups holds the user's explicit toggle state, persisted in
  // localStorage. The group that *contains* the active route always
  // appears open regardless of the persisted state, so the admin always
  // sees where they are without having to re-expand.
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      const saved = window.localStorage.getItem(SIDEBAR_OPEN_GROUPS_KEY);
      if (!saved) return new Set();
      const parsed: unknown = JSON.parse(saved);
      return new Set(Array.isArray(parsed) ? (parsed as string[]) : []);
    } catch {
      return new Set();
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(
        SIDEBAR_OPEN_GROUPS_KEY,
        JSON.stringify(Array.from(openGroups)),
      );
    } catch {
      /* localStorage may be unavailable in private mode — ignore */
    }
  }, [openGroups]);

  const toggleGroup = (label: string) => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  const isPathActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  const activeGroupLabel = ADMIN_GROUPS.find((g) =>
    g.children.some((c) => isPathActive(c.href)),
  )?.label;

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
        <div
          className={cn(
            "flex h-16 items-center border-b border-border-sidebar",
            sidebarOpen ? "justify-between px-3" : "justify-center",
          )}
        >
          {sidebarOpen ? (
            <>
              <Link href="/" className="min-w-0 flex-1 overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={isDark ? "/icons/logo.png" : "/icons/logo-light-theme.png"}
                  alt="OMG Teams"
                  className="mt-1 h-10 w-auto object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                    const fallback = (e.target as HTMLImageElement).nextElementSibling;
                    if (fallback) (fallback as HTMLElement).style.display = "block";
                  }}
                />
              </Link>
              <button
                onClick={toggleSidebar}
                aria-label="Collapse sidebar"
                className="text-text-sidebar hover:text-text-sidebar-active shrink-0 rounded-sm p-1 hover:bg-bg-hover"
              >
                <ChevronLeft size={18} />
              </button>
            </>
          ) : (
            // Collapsed: click-to-expand logo button (larger, centered)
            <button
              onClick={toggleSidebar}
              aria-label="Expand sidebar"
              title="Expand sidebar"
              className="hover:bg-bg-hover flex h-12 w-12 items-center justify-center rounded-md transition-colors"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={isDark ? "/icons/logo-collapsed.png" : "/icons/logo-collapsed-light-theme.png"}
                alt="OMG"
                className="mt-0.5 h-10 w-10 object-contain"
              />
            </button>
          )}
        </div>

        {/* Nav Items */}
        <nav ref={navRef} className="flex-1 overflow-y-auto py-3">
          {/* Top-level + grouped only when admin AND expanded — collapsed
              sidebar falls back to the flat rail so every link is one click
              away. Recruiter/RM stays flat at all sizes (short enough). */}
          {isAdmin && sidebarOpen ? (
            <>
              {ADMIN_TOP_LEVEL.map(withBadge).map((item) => (
                <SidebarLink
                  key={item.href}
                  item={item}
                  isActive={isPathActive(item.href)}
                  expanded
                  onNavigate={() => {
                    if (isMobile) toggleSidebar();
                  }}
                />
              ))}

              {/* Visual divider between pinned items and grouped sections */}
              <div className="border-border-sidebar mx-4 my-2 border-t" />

              {ADMIN_GROUPS.map((group) => (
                <NavGroupSection
                  key={group.label}
                  group={group}
                  items={group.children.map(withBadge)}
                  isOpen={openGroups.has(group.label) || activeGroupLabel === group.label}
                  isActiveGroup={activeGroupLabel === group.label}
                  onToggle={() => toggleGroup(group.label)}
                  isPathActive={isPathActive}
                  onNavigate={() => {
                    if (isMobile) toggleSidebar();
                  }}
                />
              ))}
            </>
          ) : (
            // Collapsed sidebar (any role) OR expanded recruiter/RM →
            // flat list with full icon-only support in the collapsed rail.
            flatItems.map((item) => (
              <SidebarLink
                key={item.href}
                item={item}
                isActive={isPathActive(item.href)}
                expanded={sidebarOpen}
                onNavigate={() => {
                  if (isMobile) toggleSidebar();
                }}
              />
            ))
          )}
        </nav>

        {/* User info at bottom */}
        {sidebarOpen && user && (
          <div className="border-t border-border-sidebar p-5">
            <p className="text-text-sidebar truncate text-xs">{user.name}</p>
            <p className="text-text-muted truncate text-xs">{user.role.replace("_", " ")}</p>
          </div>
        )}
      </aside>
    </>
  );
}
