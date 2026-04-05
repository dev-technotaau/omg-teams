import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "My Attendance",
  description: "View your attendance log, working hours, and monthly calendar",
};

export default function Layout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
