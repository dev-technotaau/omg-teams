import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Sessions",
  description: "View and manage active user sessions",
};

export default function Layout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
