import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Targets",
  description: "Set and manage recruiter performance targets",
};

export default function Layout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
