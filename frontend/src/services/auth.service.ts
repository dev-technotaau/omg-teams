import axios from "axios";

// ──────────────────────────────────────────────
//  Auth Service (BFF Pattern)
//
//  Auth endpoints go to /api/auth/* (Next.js BFF
//  route handlers) — NOT through /api/proxy.
//  The BFF handles cookie management server-side.
// ──────────────────────────────────────────────

export interface User {
  id: string;
  employeeId: string | null;
  email: string;
  firstName: string;
  lastName: string;
  role: "ADMIN" | "RECRUITER" | "REPORTING_MANAGER";
  profilePhotoUrl: string | null;
  status: string;
  mobileNumber: string | null;
  address: string | null;
  deviceId: string | null;
  createdAt: string;
  lastLoginAt: string | null;
}

const authApi = axios.create({
  baseURL: "/api/auth",
  withCredentials: true,
  timeout: 30_000,
  headers: { "Content-Type": "application/json" },
});

export async function loginUser(data: {
  identifier: string;
  password: string;
  role: string;
  deviceId: string;
  turnstileToken: string;
  backupCode?: string;
}): Promise<{ user: User }> {
  const res = await authApi.post<{ user: User }>("/login", data);
  return res.data;
}

export async function logoutUser(): Promise<void> {
  await authApi.post("/logout");
}

export async function refreshToken(): Promise<void> {
  await authApi.post("/refresh");
}

export async function getMe(): Promise<User> {
  const res = await authApi.get<{ user: User }>("/me");
  return res.data.user;
}
