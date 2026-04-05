import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Master Data",
  description: "Manage dropdown options for form fields",
};

export default function Layout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
