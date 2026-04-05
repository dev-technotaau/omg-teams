import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Archive",
  description: "View and restore archived records",
};

export default function Layout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
