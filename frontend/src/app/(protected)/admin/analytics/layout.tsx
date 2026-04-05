import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Analytics & Statistics",
  description: "Enterprise-grade analytics dashboard with KPIs and charts",
};

export default function Layout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
