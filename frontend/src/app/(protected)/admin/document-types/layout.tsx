import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Document Types",
  description: "Manage document types for KYC verification",
};

export default function Layout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
