import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Employees",
  description: "Manage all employees with performance and attendance data",
};

export default function Layout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
