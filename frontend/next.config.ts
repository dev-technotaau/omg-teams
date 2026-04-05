import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";

// Conditionally enable bundle analyzer when ANALYZE=true
let withBundleAnalyzer: (config: NextConfig) => NextConfig = (config) => config;
try {
  if (process.env.ANALYZE === "true") {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const analyzer = require("@next/bundle-analyzer");
    withBundleAnalyzer = analyzer({ enabled: true });
  }
} catch {
  // @next/bundle-analyzer not installed — skip
}

// PWA support (§24.19) — generates service worker for offline fallback
let withPWA: (config: NextConfig) => NextConfig = (config) => config;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pwa = require("next-pwa");
  withPWA = pwa({
    dest: "public",
    disable: process.env.NODE_ENV === "development",
    register: true,
    skipWaiting: true,
    fallbacks: {
      document: "/offline.html",
    },
  });
} catch {
  // next-pwa not installed — skip
}

const nextConfig: NextConfig = {
  reactCompiler: true,

  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.cloudinary.com" },
      { protocol: "https", hostname: "**.r2.cloudflarestorage.com" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
    ],
  },

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-DNS-Prefetch-Control", value: "on" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-XSS-Protection", value: "0" }, // Disabled — CSP is the modern replacement
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self)" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          // CSP is managed per-request by src/proxy.ts with nonce
        ],
      },
    ];
  },

  poweredByHeader: false,

  experimental: {
    optimizePackageImports: ["lucide-react", "framer-motion", "dayjs", "recharts"],
  },
};

export default withSentryConfig(withPWA(withBundleAnalyzer(nextConfig)), {
  // For all available options, see:
  // https://www.npmjs.com/package/@sentry/webpack-plugin#options

  org: "opportunitymakers-group",

  project: "omg-teams-frontend",

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
  // This can increase your server load as well as your hosting bill.
  // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
  // side errors will fail.
  tunnelRoute: "/monitoring",

  webpack: {
    // Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
    // See the following for more information:
    // https://docs.sentry.io/product/crons/
    // https://vercel.com/docs/cron-jobs
    automaticVercelMonitors: true,

    // Tree-shaking options for reducing bundle size
    treeshake: {
      // Automatically tree-shake Sentry logger statements to reduce bundle size
      removeDebugLogging: true,
    },
  }
});
