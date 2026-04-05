import { api } from "@/lib/api";

// ──────────────────────────────────────────────
//  Account Management API (Admin Self-Service)
// ──────────────────────────────────────────────

export async function changePassword(currentPassword: string, newPassword: string) {
  const res = await api.post<{ message: string }>("/auth/me/change-password", {
    currentPassword,
    newPassword,
  });
  return res.data;
}

export async function requestEmailChange(newEmail: string, password: string) {
  const res = await api.post<{ message: string }>("/auth/me/request-email-change", {
    newEmail,
    password,
  });
  return res.data;
}

export async function verifyEmailChange(otp: string) {
  const res = await api.post<{ message: string; email: string }>("/auth/me/verify-email-change", {
    otp,
  });
  return res.data;
}

export async function updateMobile(mobileNumber: string, password: string) {
  const res = await api.patch<{ message: string }>("/auth/me/mobile", {
    mobileNumber,
    password,
  });
  return res.data;
}
