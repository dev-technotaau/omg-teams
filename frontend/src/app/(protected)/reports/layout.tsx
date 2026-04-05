import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "My Reports",
  description: "View and manage your submitted candidate reports",
};

export default function Layout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
