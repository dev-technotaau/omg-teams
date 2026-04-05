import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Audit Log",
  description: "View all platform activity and change history",
};

export default function Layout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
