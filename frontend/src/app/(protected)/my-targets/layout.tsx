import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "My Targets",
  description: "Track your daily, weekly, and monthly performance targets",
};

export default function Layout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
