import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Document Verification",
  description: "Verify employee KYC documents",
};

export default function Layout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
