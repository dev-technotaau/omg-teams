import type { MetadataRoute } from "next";

/**
 * Disallow all crawling — internal platform only.
 * Spec Section 24.19
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", disallow: "/" },
  };
}
