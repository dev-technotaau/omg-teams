import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Email Templates",
  description: "Customize email template content and branding",
};

export default function Layout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
