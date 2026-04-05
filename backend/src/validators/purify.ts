import DOMPurify from "isomorphic-dompurify";

// ──────────────────────────────────────────────
//  DOMPurify Utility Functions
//
//  For cases where you need to sanitize outside
//  of Zod schemas (e.g. in services, templates,
//  or before storing rich text in the DB).
// ──────────────────────────────────────────────

/**
 * Strip ALL HTML — returns plain text.
 * Use for names, titles, single-line inputs.
 */
export function stripHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty, { ALLOWED_TAGS: [] });
}

/**
 * Sanitize HTML — keeps safe formatting tags, strips everything dangerous.
 * Use for rich text / WYSIWYG content before storing in DB.
 */
export function sanitizeHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
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
  });
}

/**
 * Ultra-strict sanitize — only inline text formatting.
 * Use for comments, chat messages, short descriptions.
 */
export function sanitizeInline(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: ["b", "i", "em", "strong", "a", "code", "br"],
    ALLOWED_ATTR: ["href", "target", "rel"],
    ALLOW_DATA_ATTR: false,
  });
}

/**
 * Check if a string contains any HTML at all.
 */
export function containsHtml(input: string): boolean {
  return input !== DOMPurify.sanitize(input, { ALLOWED_TAGS: [] });
}

/**
 * Sanitize an entire object's string values (shallow).
 * Useful for sanitizing req.body in one pass.
 */
export function sanitizeObject<T extends Record<string, unknown>>(obj: T): T {
  const result = { ...obj };
  for (const key of Object.keys(result)) {
    const value = result[key];
    if (typeof value === "string") {
      (result as Record<string, unknown>)[key] = stripHtml(value);
    }
  }
  return result;
}
