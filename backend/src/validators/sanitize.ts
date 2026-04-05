import DOMPurify from "isomorphic-dompurify";
import { z } from "zod";

// ──────────────────────────────────────────────
//  Zod Sanitization Transforms
//
//  Reusable Zod schemas that sanitize input
//  before validation. Use these instead of plain
//  z.string() when accepting user input.
// ──────────────────────────────────────────────

/**
 * Trims whitespace from both ends.
 */
export const zTrimmed = z.string().trim();

/**
 * Trims + lowercases (emails, usernames, etc.)
 */
export const zNormalized = z.string().trim().toLowerCase();

/**
 * Strips all HTML tags. Use for plain text fields
 * like names, titles, descriptions.
 */
export const zStripHtml = z
  .string()
  .trim()
  .transform((val) => DOMPurify.sanitize(val, { ALLOWED_TAGS: [] }));

/**
 * Sanitizes HTML — allows safe tags (bold, italic, links, lists)
 * but strips scripts, event handlers, and dangerous elements.
 * Use for rich text / WYSIWYG content.
 */
export const zSafeHtml = z
  .string()
  .trim()
  .transform((val) =>
    DOMPurify.sanitize(val, {
      ALLOWED_TAGS: [
        "b",
        "i",
        "em",
        "strong",
        "a",
        "p",
        "br",
        "ul",
        "ol",
        "li",
        "h1",
        "h2",
        "h3",
        "h4",
        "h5",
        "h6",
        "blockquote",
        "code",
        "pre",
        "span",
        "div",
        "img",
        "table",
        "thead",
        "tbody",
        "tr",
        "th",
        "td",
      ],
      ALLOWED_ATTR: ["href", "target", "rel", "src", "alt", "class", "id"],
      ALLOW_DATA_ATTR: false,
    }),
  );

/**
 * Email: trimmed, lowercased, validated.
 */
export const zEmail = z.string().trim().toLowerCase().pipe(z.email());

/**
 * Slug-safe string: trimmed, lowercased, only a-z 0-9 and hyphens.
 */
export const zSlug = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Must be a valid slug (lowercase, hyphens only)");

/**
 * URL: trimmed, validated.
 */
export const zUrl = z.string().trim().pipe(z.url());

/**
 * Sanitized string with min/max length.
 * Strips HTML and enforces length constraints.
 */

export function zSafeString(min: number, max: number) {
  return z
    .string()
    .trim()
    .min(min)
    .max(max)
    .transform((val) => DOMPurify.sanitize(val, { ALLOWED_TAGS: [] }))
    .pipe(z.string().min(min)); // re-validate length after sanitization
}

/**
 * Pagination params — safe defaults, capped max.
 */
export const zPagination = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.string().trim().optional(),
  order: z.enum(["asc", "desc"]).default("desc"),
});

/**
 * ID param — CUID format (Prisma default).
 */
export const zCuidParam = z.object({
  id: z.cuid(),
});

/**
 * UUID param.
 */
export const zUuidParam = z.object({
  id: z.uuid(),
});
