import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import { Suspense } from "react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/next";
import { Providers } from "@/components/providers";
import { GoogleAnalytics } from "@/components/scripts/google-analytics";
import { GTMScript, GTMNoScript } from "@/components/scripts/google-tag-manager";
import { FacebookPixel } from "@/components/scripts/facebook-pixel";
import { RouteAnalytics } from "@/components/scripts/route-analytics";
import { env } from "@/lib/env";
import "./globals.css";

const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
});

const APP_NAME = env.APP_NAME;
const APP_DESCRIPTION =
  "Internal Recruitment, Employee & Workforce Management Platform by Opportunity Makers Group. Manage candidates, attendance, leaves, documents, KYC, analytics, and team performance.";
const APP_URL = env.APP_URL;

// ──────────────────────────────────────────────
//  SEO, Metadata, OpenGraph, Twitter Cards
// ──────────────────────────────────────────────

export const metadata: Metadata = {
  // Core
  metadataBase: new URL(APP_URL),
  title: {
    default: APP_NAME,
    template: `%s | ${APP_NAME}`,
  },
  description: APP_DESCRIPTION,
  applicationName: APP_NAME,
  authors: [{ name: "Opportunity Makers Group", url: "https://www.opportunitymakers.in" }],
  creator: "Opportunity Makers Group",
  publisher: "Opportunity Makers Group",
  generator: "Next.js",

  // Keywords
  keywords: [
    "OMG Teams",
    "Opportunity Makers Group",
    "recruitment management",
    "workforce management",
    "employee management",
    "attendance tracking",
    "leave management",
    "KYC verification",
    "candidate sourcing",
    "HR platform",
    "team performance",
    "internal platform",
  ],

  // Robots — internal platform, block indexing
  robots: {
    index: false,
    follow: false,
    googleBot: { index: false, follow: false },
  },

  // Icons — Next.js auto-discovers favicon.ico and apple-icon.png from src/app/
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-icon.png" }],
  },

  // Open Graph — for Slack, Teams, social link previews
  openGraph: {
    type: "website",
    siteName: APP_NAME,
    title: "OMG Teams — Opportunity Makers Group",
    description: APP_DESCRIPTION,
    url: APP_URL,
    locale: "en_IN",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "OMG Teams — Internal Recruitment & Workforce Management Platform",
        type: "image/png",
      },
      {
        url: "/og-image-square.png",
        width: 512,
        height: 512,
        alt: "OMG Teams Logo",
        type: "image/png",
      },
    ],
  },

  // Twitter / X Card
  twitter: {
    card: "summary_large_image",
    title: "OMG Teams — Opportunity Makers Group",
    description: APP_DESCRIPTION,
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "OMG Teams Platform",
      },
    ],
    creator: "@opportunitymakers",
  },

  // App links
  alternates: {
    canonical: APP_URL,
  },

  // Category
  category: "Business",

  // Verification — add tokens when available
  // verification: {
  //   google: "google-site-verification-token",
  // },
};

// Viewport — separated from metadata per Next.js 14+ best practice
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#001845" },
    { media: "(prefers-color-scheme: dark)", color: "#001845" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  colorScheme: "light dark",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const nonce = (await headers()).get("x-nonce") || "";

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${plusJakarta.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <head>
        {/* JSON-LD Structured Data — Organization schema */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              name: "Opportunity Makers Group",
              alternateName: "OMG Teams",
              url: "https://www.opportunitymakers.in",
              logo: `${APP_URL}/icons/logo-light-theme.png`,
              description: APP_DESCRIPTION,
              address: {
                "@type": "PostalAddress",
                streetAddress: "302-Village Dhogri Road, Tehsil Nangal Salempur-1",
                addressLocality: "Jalandhar",
                addressRegion: "Punjab",
                postalCode: "144004",
                addressCountry: "IN",
              },
              contactPoint: {
                "@type": "ContactPoint",
                email: "info@opportunitymakers.in",
                contactType: "General Inquiry",
              },
              sameAs: ["https://www.opportunitymakers.in"],
            }),
          }}
        />
      </head>
      <body className="flex min-h-full flex-col" nonce={nonce}>
        {/* GTM noscript fallback — must be first in body */}
        <GTMNoScript />
        <Providers nonce={nonce}>{children}</Providers>
        {/* Analytics scripts — loaded after interactive */}
        <GoogleAnalytics />
        <GTMScript />
        <FacebookPixel />
        <Suspense fallback={null}>
          <RouteAnalytics />
        </Suspense>
        {/* §24.16 — Vercel Web Vitals + Analytics */}
        <SpeedInsights />
        <Analytics />
      </body>
    </html>
  );
}
