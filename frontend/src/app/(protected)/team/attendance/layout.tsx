import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Team Attendance",
  description: "View attendance data for your assigned recruiters",
};

export default function Layout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
