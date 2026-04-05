import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Notifications",
  description: "View all your notifications",
};

export default function Layout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
