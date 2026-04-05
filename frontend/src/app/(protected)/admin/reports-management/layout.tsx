import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Reports Management",
  description: "Generate, schedule, and manage XLSX reports",
};

export default function Layout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
