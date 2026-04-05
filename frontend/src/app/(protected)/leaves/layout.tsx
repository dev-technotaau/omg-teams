import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "My Leaves",
  description: "Apply for leave, view requests, and check leave balance",
};

export default function Layout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
