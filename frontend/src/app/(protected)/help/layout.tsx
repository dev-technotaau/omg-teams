import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Help & FAQ",
  description: "Frequently asked questions and platform guide",
};

export default function Layout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
