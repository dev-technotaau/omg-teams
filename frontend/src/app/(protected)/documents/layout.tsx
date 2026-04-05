import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "My Documents",
  description: "Upload and manage your KYC documents",
};

export default function Layout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
