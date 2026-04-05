import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Login",
  description: "Sign in to OMG Teams — Internal Recruitment & Workforce Management Platform",
};

/**
 * Login layout — no sidebar, no header. Just the form.
 */
export default function LoginLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
