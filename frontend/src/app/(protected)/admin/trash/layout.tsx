import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Trash",
  description: "Restore or permanently delete soft-deleted records",
};

export default function Layout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
