import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Holiday Calendar",
  description: "Manage platform holidays and non-working days",
};

export default function Layout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
