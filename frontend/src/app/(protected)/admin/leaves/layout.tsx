import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Leave Management",
  description: "Approve, reject, and manage employee leave requests",
};

export default function Layout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
