import type { MetadataRoute } from "next";

/**
 * Empty sitemap — internal platform, no pages to index.
 * Spec Section 24.19
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [];
}
