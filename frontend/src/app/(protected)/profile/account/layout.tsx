import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Account Settings",
  description: "Change your password, email address, and mobile number",
};

export default function Layout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
