// ──────────────────────────────────────────────
//  Query Parameter Helpers
// ──────────────────────────────────────────────

/** Build a clean params object, omitting empty/falsy values */
export function buildParams(
  raw: Record<string, string | number | boolean | undefined | null>,
): Record<string, string> {
  const params: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (value !== undefined && value !== null && value !== "") {
      params[key] = String(value);
    }
  }
  return params;
}
