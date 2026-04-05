import type { MetadataRoute } from "next";

/**
 * §24.19.2 — Web App Manifest for PWA installation.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "OMG Teams — Opportunity Makers Group",
    short_name: "OMG Teams",
    description: "Internal Recruitment, Employee & Workforce Management Platform",
    start_url: "/login",
    display: "standalone",
    background_color: "#F8FAFC",
    theme_color: "#001845",
    orientation: "portrait-primary",
    scope: "/",
    icons: [
      { src: "/favicon.ico", sizes: "any", type: "image/x-icon" },
      { src: "/icons/icon-72x72.png", sizes: "72x72", type: "image/png" },
      { src: "/icons/icon-96x96.png", sizes: "96x96", type: "image/png" },
      { src: "/icons/icon-128x128.png", sizes: "128x128", type: "image/png" },
      { src: "/icons/icon-144x144.png", sizes: "144x144", type: "image/png" },
      { src: "/icons/icon-152x152.png", sizes: "152x152", type: "image/png" },
      { src: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon-384x384.png", sizes: "384x384", type: "image/png" },
      { src: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
