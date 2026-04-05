import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "My Profile",
  description: "View and edit your profile, photo, and personal information",
};

export default function Layout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
