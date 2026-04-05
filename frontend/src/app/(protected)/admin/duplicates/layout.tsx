import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Duplicates",
  description: "Manage duplicate candidate records",
};

export default function Layout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
