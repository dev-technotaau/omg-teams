import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Settings",
  description: "Platform-wide configuration and preferences",
};

export default function Layout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
