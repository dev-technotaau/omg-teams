import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "User Management",
  description: "Create, suspend, and manage employee accounts",
};

export default function Layout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
