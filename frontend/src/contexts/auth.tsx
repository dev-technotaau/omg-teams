"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { connectSocket, disconnectSocket, getSocket } from "@/lib/socket";
import { loginUser, getMe, logoutUser } from "@/services/auth.service";
import type { ReactNode } from "react";

// ──────────────────────────────────────────────
//  Auth Context
//
//  Manages current user state. Works with BFF
//  cookie auth — no tokens stored in JS.
// ──────────────────────────────────────────────

export interface User {
  id: string;
  employeeId: string | null;
  email: string;
  firstName: string;
  lastName: string;
  /** Computed from firstName + lastName */
  name: string;
  profilePhotoUrl: string | null;
  role: string;
  status?: string;
  mobileNumber?: string | null;
  address?: string | null;
  deviceId?: string | null;
  createdAt?: string;
  lastLoginAt?: string | null;
  assignedManagers?: { manager: { id: string; firstName: string; lastName: string } }[];
}

export interface LoginPayload {
  identifier: string;
  password: string;
  role: string;
  deviceId: string;
  turnstileToken: string;
  backupCode?: string;
}

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  unreadNotifications: number;
  login: (payload: LoginPayload) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

/** Map raw backend user response to User with computed `name` */
function mapUser(raw: Record<string, unknown>): User {
  const firstName = (raw.firstName as string) ?? "";
  const lastName = (raw.lastName as string) ?? "";
  return {
    ...raw,
    firstName,
    lastName,
    name: `${firstName} ${lastName}`.trim(),
  } as User;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  const joinSocketRooms = useCallback((u: User) => {
    connectSocket();
    try {
      const socket = getSocket();
      socket.emit("auth:join", { userId: u.id, role: u.role });

      // Listen for real-time notification count updates
      socket.off("notification:count");
      socket.on("notification:count", (data: { unreadCount: number }) => {
        setUnreadNotifications(data.unreadCount);
      });

      // Listen for new notifications (for toast display etc.)
      socket.off("notification:new");
      socket.on("notification:new", () => {
        setUnreadNotifications((prev) => prev + 1);
      });
    } catch {
      // Socket not ready yet
    }
  }, []);

  const refresh = useCallback(async () => {
    try {
      const me = await getMe();
      const u = mapUser(me as unknown as Record<string, unknown>);
      setUser(u);
      joinSocketRooms(u);
    } catch {
      setUser(null);
      disconnectSocket();
    } finally {
      setIsLoading(false);
    }
  }, [joinSocketRooms]);

  const login = useCallback(
    async (payload: LoginPayload) => {
      const { user: loggedInUser } = await loginUser(payload);
      const u = mapUser(loggedInUser as unknown as Record<string, unknown>);
      setUser(u);
      joinSocketRooms(u);
    },
    [joinSocketRooms],
  );

  const logout = useCallback(async () => {
    try {
      await logoutUser();
    } catch {
      // ignore — server may already have cleared cookies
    } finally {
      setUser(null);
      setUnreadNotifications(0);
      disconnectSocket();
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: user !== null,
        unreadNotifications,
        login,
        logout,
        refresh,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
