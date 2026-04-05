import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "My Recruiters",
  description: "View your assigned recruiters and their performance",
};

export default function Layout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
