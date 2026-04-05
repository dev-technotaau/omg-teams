import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Companies",
  description: "Manage companies, service providers, and HR managers",
};

export default function Layout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
