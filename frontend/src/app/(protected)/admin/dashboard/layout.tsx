import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Admin Dashboard",
  description: "Operational overview with attendance, KPIs, and logins",
};

export default function Layout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
