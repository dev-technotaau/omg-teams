import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Your personal dashboard with KPIs, attendance, and performance overview",
};

export default function Layout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
