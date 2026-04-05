"use client";

import { useCallback, useMemo, useState, useRef } from "react";
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
  LayoutDashboard,
  Users,
  FileText,
  Calendar,
  ExternalLink,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useAuth } from "@/contexts/auth";
import { api } from "@/lib/api";
import { useKeyboardShortcut } from "@/hooks";
import { usePresence } from "@/hooks/use-presence";
import { useUIStore } from "@/store/ui";
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
import { ROUTES } from "@/constants/routes";
import type { MenuGroup } from "@/components/ui/dropdown-menu";
import type { CommandGroup } from "@/components/ui/command-palette";

// ──────────────────────────────────────────────
//  Top Header — Spec Section 18
//  Avatar dropdown, notification bell, command palette, live dot
// ──────────────────────────────────────────────

export function Header() {
  const { user, logout, unreadNotifications } = useAuth();
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const commandPalette = useCommandPalette();

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

  const markAsRead = useCallback(async (id: string) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifItems((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    } catch {
      /* silent */
    }
  }, []);

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
  const commandGroups: CommandGroup[] = useMemo(
    () => [
      {
        label: "Navigation",
        items: [
          {
            id: "nav-dashboard",
            label: "Go to Dashboard",
            icon: LayoutDashboard,
            shortcut: "G D",
            keywords: ["home", "overview"],
            onSelect: () => router.push(ROUTES.DASHBOARD),
          },
          {
            id: "nav-team",
            label: "Go to Team",
            icon: Users,
            shortcut: "G T",
            keywords: ["members", "people"],
            onSelect: () => router.push(ROUTES.TEAM),
          },
          {
            id: "nav-reports",
            label: "Go to Reports",
            icon: FileText,
            shortcut: "G R",
            keywords: ["analytics"],
            onSelect: () => router.push(ROUTES.REPORTS),
          },
          {
            id: "nav-schedule",
            label: "Go to Schedule",
            icon: Calendar,
            shortcut: "G S",
            keywords: ["calendar", "shifts"],
            onSelect: () => router.push(ROUTES.ATTENDANCE),
          },
          {
            id: "nav-notifications",
            label: "Go to Notifications",
            icon: Bell,
            keywords: ["alerts"],
            onSelect: () => router.push(ROUTES.NOTIFICATIONS),
          },
          {
            id: "nav-search",
            label: "Go to Search",
            icon: Search,
            keywords: ["find", "query", "global"],
            onSelect: () => router.push(ROUTES.SEARCH),
          },
          {
            id: "nav-profile",
            label: "Go to Profile",
            icon: User,
            keywords: ["account", "settings"],
            onSelect: () => router.push(ROUTES.PROFILE),
          },
        ],
      },
      {
        label: "Actions",
        items: [
          {
            id: "action-theme",
            label: theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode",
            icon: theme === "dark" ? Sun : Moon,
            keywords: ["theme", "dark", "light", "mode"],
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
      },
    ],
    [router, theme, setTheme, handleLogout],
  );

  return (
    <>
      <header className="border-border-default bg-bg-surface flex h-14 items-center justify-between border-b px-6">
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
              src={theme === "dark" ? "/icons/logo.png" : "/icons/logo-light-theme.png"}
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

          {/* Avatar + Dropdown */}
          <DropdownMenu
            trigger={
              <Avatar
                src={user?.profilePhotoUrl}
                name={user?.name ?? "User"}
                size="sm"
                status={ownStatus}
                className="cursor-pointer"
              />
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
      />
    </>
  );
}
