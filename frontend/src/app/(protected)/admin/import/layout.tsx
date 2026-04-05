import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Data Import",
  description: "Bulk import candidates via CSV or XLSX upload",
};

export default function Layout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
