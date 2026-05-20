"use client";

import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bell,
  Search,
  LogOut,
  User,
  Moon,
  Sun,
  BellRing,
  HelpCircle,
  ExternalLink,
  Pin,
  FilePlus,
  Download,
  CalendarClock,
  Target,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useAuth } from "@/contexts/auth";
import { api } from "@/lib/api";
import {
  useKeyboardShortcut,
  usePinned,
  useRecents,
  useRecentQueries,
  useLeaderKey,
  type LeaderBinding,
} from "@/hooks";
import { ShortcutHud } from "@/components/layout/shortcut-hud";
import { usePresence } from "@/hooks/use-presence";
import { useUIStore } from "@/store/ui";
import { useAppDispatch, useAppSelector, decrementUnreadCount } from "@/store/redux";
import {
  Avatar,
  DropdownMenu,
  IconButton,
  NotificationBadge,
  Tooltip,
  CommandPalette,
  useCommandPalette,
  NotificationItem as NotificationItemComponent,
} from "@/components/ui";
import type { NotificationData } from "@/components/ui";
import { useClickOutside } from "@/hooks/use-click-outside";
import { cn } from "@/lib/utils";
import { ROLES } from "@/constants/roles";
import { ROUTES } from "@/constants/routes";
import { buildPaletteSections } from "@/lib/nav-config";
import type { MenuGroup } from "@/components/ui/dropdown-menu";
import type { CommandGroup, CommandItem } from "@/components/ui/command-palette";

// ──────────────────────────────────────────────
//  Top Header — Spec Section 18
//  Avatar dropdown, notification bell, command palette, live dot
// ──────────────────────────────────────────────

export function Header() {
  const { user, logout } = useAuth();
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [themeMounted, setThemeMounted] = useState(false);
  useEffect(() => {
    setThemeMounted(true);
  }, []);
  const isDark = themeMounted && resolvedTheme === "dark";
  const router = useRouter();
  const commandPalette = useCommandPalette();

  // Unread count is sourced from Redux (kept in sync by NotificationProvider
  // via REST polling, Socket.IO, Web Push, and FCM — see contexts/notification.tsx)
  const dispatch = useAppDispatch();
  const unreadNotifications = useAppSelector((s) => s.notifications.unreadCount);

  // Ctrl/Cmd+K opens command palette
  useKeyboardShortcut("k", () => commandPalette.setOpen(true), { ctrl: true });

  // §23.15 — Dynamic presence status for own avatar (Firebase + Redis fallback)
  const selfPresenceIds = useMemo(() => (user?.id ? [user.id] : []), [user?.id]);
  const presenceMap = usePresence(selfPresenceIds);
  const ownPresence = user?.id ? presenceMap[user.id] : undefined;
  const rawStatus = ownPresence?.status ?? "online";
  // Map presence to Avatar-compatible status (idle → away)
  const ownStatus = rawStatus === "idle" ? ("away" as const) : (rawStatus as "online" | "offline");

  // Notification dropdown state
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifItems, setNotifItems] = useState<NotificationData[]>([]);
  const [notifLoading, setNotifLoading] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = useCallback(async () => {
    setNotifLoading(true);
    try {
      const res = await api.get<{ data: NotificationData[] }>("/notifications", {
        params: { limit: "20" }, // §11.2.1 — shows last 20-30 notifications
      });
      setNotifItems(res.data.data ?? []);
    } catch {
      /* silent */
    } finally {
      setNotifLoading(false);
    }
  }, []);

  const toggleNotifDropdown = useCallback(() => {
    setNotifOpen((prev) => {
      if (!prev) void fetchNotifications();
      return !prev;
    });
  }, [fetchNotifications]);

  // Close on outside click
  useClickOutside(notifRef, () => {
    if (notifOpen) setNotifOpen(false);
  });

  const markAsRead = useCallback(
    async (id: string) => {
      // Only decrement if this item was actually unread
      const wasUnread = notifItems.find((n) => n.id === id)?.isRead === false;
      try {
        await api.patch(`/notifications/${id}/read`);
        setNotifItems((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
        // Optimistic Redux decrement — backend also emits notification:count
        // via socket with the authoritative value right after.
        if (wasUnread) dispatch(decrementUnreadCount());
      } catch {
        /* silent */
      }
    },
    [dispatch, notifItems],
  );

  const handleLogout = useCallback(async () => {
    await logout();
    router.push(ROUTES.LOGIN);
  }, [logout, router]);

  // -- Avatar dropdown menu groups --
  const avatarMenuGroups: MenuGroup[] = useMemo(
    () => [
      {
        label: user?.name ?? undefined,
        items: [
          {
            label: user?.role?.replace("_", " ") ?? "User",
            disabled: true,
            description: user?.email ?? undefined,
          },
        ],
      },
      {
        items: [
          {
            label: "My Profile",
            icon: User,
            href: ROUTES.PROFILE,
          },
          {
            label: "Notification Settings",
            icon: BellRing,
            href: ROUTES.NOTIFICATION_SETTINGS,
          },
          {
            label: "Help",
            icon: HelpCircle,
            href: ROUTES.HELP,
          },
        ],
      },
      {
        items: [
          {
            label: "Logout",
            icon: LogOut,
            danger: true,
            onClick: () => void handleLogout(),
          },
        ],
      },
    ],
    [user, handleLogout],
  );

  // -- Command palette groups --
  // ── Cmd+K palette state ──
  // Pinned items, route-history "recents", and query history. All persisted
  // in localStorage so the user's keyboard workflow survives reloads.
  const { pinned, togglePin, isPinned } = usePinned();
  const { recents } = useRecents();
  const { queries: queryHistory, pushQuery } = useRecentQueries();

  const role = user?.role ?? "";

  // Map every nav item the user can see by href — used to resolve pinned/
  // recent href strings back into the full NavItem so the palette can show
  // them with the right icon + label + keywords + leader-key shortcut.
  type NavEntry = {
    label: string;
    icon: typeof Bell;
    href: string;
    groupLabel: string | null;
    keywords?: string[];
    shortcut?: { key: string };
  };
  const navByHref = useMemo(() => {
    const sections = buildPaletteSections(role);
    const m = new Map<string, NavEntry>();
    for (const section of sections) {
      for (const item of section.items) {
        const entry: NavEntry = {
          label: item.label,
          icon: item.icon,
          href: item.href,
          groupLabel: item.groupLabel,
        };
        if (item.keywords) entry.keywords = item.keywords;
        if (item.shortcut) entry.shortcut = item.shortcut;
        m.set(item.href, entry);
      }
    }
    return m;
  }, [role]);

  // Pin/unpin button rendered at the right edge of every nav row.
  // stopPropagation on the wrapping <span> in CommandPalette prevents the
  // click from bubbling up to the row's onSelect, so toggling doesn't navigate.
  const renderPinButton = (href: string) => {
    const pinnedFlag = isPinned(href);
    return (
      <button
        type="button"
        title={pinnedFlag ? "Unpin from palette" : "Pin to palette"}
        aria-label={pinnedFlag ? "Unpin" : "Pin"}
        onClick={() => togglePin(href)}
        className={cn(
          "rounded p-1 transition-colors",
          pinnedFlag
            ? "text-yellow-500 hover:text-yellow-600"
            : "text-text-muted opacity-0 group-hover/cmd:opacity-100 hover:text-text-primary",
        )}
      >
        <Pin
          size={12}
          fill={pinnedFlag ? "currentColor" : "none"}
          className={pinnedFlag ? "-rotate-45" : ""}
        />
      </button>
    );
  };

  // Build a palette item from a nav entry (used by Pinned / Recents /
  // every nav section). Keywords mirror the label + group label + any
  // static aliases declared on the NavItem (e.g. "schedule" / "shifts"
  // for the attendance row) so users keep finding things by their old
  // names even after a rename in the nav config. The leader-key shortcut
  // (if any) is shown as a `G X` kbd at the right edge.
  const buildNavCommand = (nav: NavEntry): CommandItem => {
    const keywords = ["navigate", "go to", nav.label.toLowerCase()];
    if (nav.groupLabel) keywords.push(nav.groupLabel.toLowerCase());
    if (nav.keywords) keywords.push(...nav.keywords);
    const cmd: CommandItem = {
      id: `nav-${nav.href}`,
      label: nav.label,
      icon: nav.icon,
      keywords,
      href: nav.href,
      onSelect: () => router.push(nav.href),
      trailing: renderPinButton(nav.href),
    };
    if (nav.shortcut) {
      cmd.shortcut = `G ${nav.shortcut.key.toUpperCase()}`;
    }
    return cmd;
  };

  const commandGroups: CommandGroup[] = useMemo(() => {
    const built: CommandGroup[] = [];

    // ── Pinned (always at the top when present) ──
    const pinnedItems = pinned
      .map((href) => navByHref.get(href))
      .filter((x): x is NonNullable<ReturnType<typeof navByHref.get>> => Boolean(x));
    if (pinnedItems.length > 0) {
      built.push({
        label: "Pinned",
        items: pinnedItems.map(buildNavCommand),
      });
    }

    // ── Recents (excluding anything already pinned to avoid duplicates) ──
    const recentItems = recents
      .map((href) => navByHref.get(href))
      .filter((x): x is NonNullable<ReturnType<typeof navByHref.get>> => Boolean(x))
      .filter((item) => !pinned.includes(item.href));
    if (recentItems.length > 0) {
      built.push({
        label: "Recents",
        items: recentItems.map(buildNavCommand),
      });
    }

    // ── Quick actions (role-specific shortcuts to create / generate / etc.) ──
    const quickActions: CommandItem[] = [];
    if (role === ROLES.RECRUITER) {
      quickActions.push({
        id: "qa-add-report",
        label: "New candidate report",
        icon: FilePlus,
        keywords: ["create", "add", "candidate", "report", "new"],
        href: ROUTES.REPORTS_NEW,
        onSelect: () => router.push(ROUTES.REPORTS_NEW),
      });
    }
    if (role === ROLES.ADMIN) {
      const generateHref = `${ROUTES.ADMIN_REPORTS_MANAGEMENT}?tab=generate`;
      const scheduleHref = `${ROUTES.ADMIN_REPORTS_MANAGEMENT}?tab=schedule`;
      quickActions.push(
        {
          id: "qa-generate-report",
          label: "Generate report…",
          icon: Download,
          keywords: ["download", "export", "xlsx", "generate", "report"],
          href: generateHref,
          onSelect: () => router.push(generateHref),
        },
        {
          id: "qa-schedule-report",
          label: "Schedule a report…",
          icon: CalendarClock,
          keywords: ["schedule", "recurring", "email", "report"],
          href: scheduleHref,
          onSelect: () => router.push(scheduleHref),
        },
        {
          id: "qa-new-target",
          label: "Set a new target…",
          icon: Target,
          keywords: ["create", "add", "goal", "target", "kpi"],
          href: ROUTES.ADMIN_TARGETS,
          onSelect: () => router.push(ROUTES.ADMIN_TARGETS),
        },
      );
    }
    if (quickActions.length > 0) {
      built.push({ label: "Quick actions", items: quickActions });
    }

    // ── Navigation (every role-visible nav item, grouped by its group) ──
    for (const section of buildPaletteSections(role)) {
      if (section.items.length === 0) continue;
      built.push({
        label: section.label,
        items: section.items.map(buildNavCommand),
      });
    }

    // ── Account ──
    // Pages that aren't part of the sidebar nav but the user often wants
    // quick keyboard access to.
    built.push({
      label: "Account",
      items: [
        {
          id: "nav-notifications",
          label: "Notifications",
          icon: Bell,
          keywords: ["alerts", "inbox"],
          href: ROUTES.NOTIFICATIONS,
          onSelect: () => router.push(ROUTES.NOTIFICATIONS),
        },
        // Admin-only — global cross-entity search is an admin workflow and
        // the page itself lives at /admin/search (gated by route prefix).
        ...(role === ROLES.ADMIN
          ? [
              {
                id: "nav-search",
                label: "Global search",
                icon: Search,
                keywords: ["find", "query"],
                href: ROUTES.SEARCH,
                onSelect: () => router.push(ROUTES.SEARCH),
              } as CommandItem,
            ]
          : []),
        {
          id: "nav-profile",
          label: "My profile",
          icon: User,
          keywords: ["account", "me"],
          href: ROUTES.PROFILE,
          onSelect: () => router.push(ROUTES.PROFILE),
        },
        {
          id: "nav-notif-settings",
          label: "Notification settings",
          icon: BellRing,
          keywords: ["preferences", "quiet hours"],
          href: ROUTES.NOTIFICATION_SETTINGS,
          onSelect: () => router.push(ROUTES.NOTIFICATION_SETTINGS),
        },
        {
          id: "nav-help",
          label: "Help",
          icon: HelpCircle,
          keywords: ["docs", "support", "faq"],
          href: ROUTES.HELP,
          onSelect: () => router.push(ROUTES.HELP),
        },
      ],
    });

    // ── System actions ──
    built.push({
      label: "Actions",
      items: [
        {
          id: "action-theme",
          label: theme === "dark" ? "Switch to light mode" : "Switch to dark mode",
          icon: theme === "dark" ? Sun : Moon,
          keywords: ["theme", "dark", "light", "mode", "appearance"],
          onSelect: () => setTheme(theme === "dark" ? "light" : "dark"),
        },
        {
          id: "action-logout",
          label: "Logout",
          icon: LogOut,
          keywords: ["sign out", "exit"],
          onSelect: () => void handleLogout(),
        },
      ],
    });

    return built;
    // buildNavCommand / renderPinButton are closures that depend on `pinned`
    // (via isPinned). Listing `pinned` as a dep is sufficient; the closures
    // are recreated each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pinned, recents, role, navByHref, theme, setTheme, handleLogout, router]);

  // ── Leader-key shortcuts (G D, G R, G A, etc.) ──
  // Derived from the same nav-config used by the sidebar + palette so the
  // three surfaces stay in sync. Account-level shortcuts (Notifications,
  // Profile, Help, Search) are added below and aren't tied to any nav
  // item. Conflicts within a single role are avoided at the nav-config
  // level; nothing here resolves duplicates.
  const leaderBindings: LeaderBinding[] = useMemo(() => {
    const out: LeaderBinding[] = [];
    for (const entry of navByHref.values()) {
      if (entry.shortcut?.key) {
        out.push({
          key: entry.shortcut.key,
          label: entry.label,
          action: () => router.push(entry.href),
        });
      }
    }
    // Account / system shortcuts — same leader, single letters that don't
    // conflict with any role's nav items.
    out.push(
      { key: "n", label: "Notifications", action: () => router.push(ROUTES.NOTIFICATIONS) },
      { key: "p", label: "My profile", action: () => router.push(ROUTES.PROFILE) },
      { key: "h", label: "Help", action: () => router.push(ROUTES.HELP) },
      { key: "k", label: "Command palette", action: () => commandPalette.setOpen(true) },
    );
    // Admin-only shortcut — global cross-entity search
    if (role === ROLES.ADMIN) {
      out.push({
        key: "s",
        label: "Global search",
        action: () => router.push(ROUTES.SEARCH),
      });
    }
    return out;
  }, [navByHref, router, commandPalette, role]);

  // Disable the leader while the Cmd+K palette is open so typing "g" into
  // the search input doesn't get swallowed by the shortcut handler.
  const { isWaiting: leaderWaiting } = useLeaderKey({
    bindings: leaderBindings,
    enabled: !commandPalette.open,
  });

  return (
    <>
      <header className="border-border-default bg-bg-surface flex h-16 items-center justify-between border-b px-6 lg:px-8">
        {/* Left: Logo (mobile) + Command palette trigger / global search */}
        <div className="flex items-center gap-3">
          {/* Hamburger menu — mobile only, opens sidebar overlay */}
          <button
            type="button"
            onClick={() => useUIStore.getState().toggleSidebar()}
            className="text-text-secondary hover:text-text-primary rounded-md p-1.5 lg:hidden"
            aria-label="Toggle menu"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          {/* Logo — visible on mobile / when sidebar collapsed */}
          <Link href="/" className="shrink-0 lg:hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={isDark ? "/icons/logo.png" : "/icons/logo-light-theme.png"}
              alt="OMG Teams"
              className="h-8 w-auto"
              onError={(e) => {
                // Fallback to text if image missing
                (e.target as HTMLImageElement).replaceWith(
                  Object.assign(document.createElement("span"), {
                    className: "text-text-primary font-bold text-sm",
                    textContent: "OMG Teams",
                  }),
                );
              }}
            />
          </Link>
          <button
            type="button"
            data-tour="command-palette"
            onClick={() => commandPalette.setOpen(true)}
            className="border-border-default bg-bg-input text-text-muted hover:border-border-hover hidden h-9 items-center gap-2 rounded-md border px-3 text-sm transition-colors sm:flex sm:w-48 lg:w-64"
          >
            <Search size={16} className="shrink-0" />
            <span className="flex-1 text-left">Search... </span>
            <kbd className="border-border-default bg-bg-muted ml-auto shrink-0 rounded-sm border px-1.5 py-0.5 font-mono text-xs">
              Ctrl+K
            </kbd>
          </button>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-3">
          {/* Global search — admin only. The /search page itself is reachable
              by direct URL for any role, but the backend search service already
              role-scopes results (recruiter sees only their own candidates,
              RM sees their team, admin sees everything). The UI affordance
              is admin-only because cross-entity search (companies, SPs, HR
              managers, users) is overwhelmingly an admin workflow. */}
          {role === ROLES.ADMIN && (
            <Tooltip content="Global search">
              <IconButton
                icon={Search}
                aria-label="Global search"
                variant="ghost"
                size="md"
                onClick={() => router.push(ROUTES.SEARCH)}
              />
            </Tooltip>
          )}

          {/* Theme toggle */}
          <Tooltip content={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}>
            <IconButton
              icon={theme === "dark" ? Sun : Moon}
              aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              variant="ghost"
              size="md"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            />
          </Tooltip>

          {/* Notifications Dropdown */}
          <div className="relative" ref={notifRef} data-tour="notifications">
            <Tooltip content="Notifications">
              <span className="relative inline-flex">
                <IconButton
                  icon={Bell}
                  aria-label="Notifications"
                  variant="ghost"
                  size="md"
                  onClick={toggleNotifDropdown}
                />
                <NotificationBadge count={unreadNotifications} />
              </span>
            </Tooltip>

            {notifOpen && (
              <div className="border-border-default bg-bg-surface-raised absolute top-full right-0 z-50 mt-2 w-80 rounded-lg border shadow-xl">
                <div className="border-border-default flex items-center justify-between border-b px-4 py-3">
                  <h3 className="text-text-primary text-sm font-semibold">Notifications</h3>
                  <button
                    onClick={() => {
                      setNotifOpen(false);
                      router.push(ROUTES.NOTIFICATIONS);
                    }}
                    className="text-primary-500 flex items-center gap-1 text-xs hover:underline"
                  >
                    View all <ExternalLink size={10} />
                  </button>
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {notifLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="border-primary-500 h-5 w-5 animate-spin rounded-full border-2 border-t-transparent" />
                    </div>
                  ) : notifItems.length === 0 ? (
                    <div className="text-text-muted px-4 py-8 text-center text-sm">
                      No new notifications
                    </div>
                  ) : (
                    notifItems.map((n) => (
                      <NotificationItemComponent
                        key={n.id}
                        notification={n}
                        variant="compact"
                        onClick={() => {
                          void markAsRead(n.id);
                          setNotifOpen(false);
                          router.push(ROUTES.NOTIFICATIONS);
                        }}
                      />
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Avatar + Dropdown — wrap in a 36x36 (h-9 w-9) box so its
              layout matches the IconButton md size used by the theme and
              notification buttons next to it. Without this wrapper the
              avatar's 32x32 (sm) bounding box throws off the gap-3 visual
              rhythm because its center sits 2px closer to the bell than
              the bell sits to the theme button. Avatar visual size stays
              at sm — only the click target / layout box grows. */}
          <DropdownMenu
            trigger={
              <div className="flex h-9 w-9 items-center justify-center">
                <Avatar
                  src={user?.profilePhotoUrl}
                  name={user?.name ?? "User"}
                  size="sm"
                  status={ownStatus}
                  className="cursor-pointer"
                />
              </div>
            }
            groups={avatarMenuGroups}
            align="right"
          />
        </div>
      </header>

      {/* Command Palette (portal-rendered) */}
      <CommandPalette
        open={commandPalette.open}
        onClose={commandPalette.onClose}
        groups={commandGroups}
        history={queryHistory}
        onSubmitQuery={pushQuery}
      />

      {/* Leader-key HUD — waiting hint + ? help overlay */}
      <ShortcutHud isWaiting={leaderWaiting} bindings={leaderBindings} />
    </>
  );
}
