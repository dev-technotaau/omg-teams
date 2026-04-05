import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Candidate Reports",
  description: "View and manage all candidate recruitment reports",
};

export default function Layout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
