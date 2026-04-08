import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Team Targets",
  description: "Track target progress for your assigned recruiters",
};

export default function Layout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
