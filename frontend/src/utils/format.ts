// ──────────────────────────────────────────────
//  Formatting Utilities
// ──────────────────────────────────────────────

/** Format a number as Indian currency (₹) */
export function formatCurrency(amount: number, locale = "en-IN"): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

/** Format a number with commas (Indian grouping by default) */
export function formatNumber(n: number, locale = "en-IN"): string {
  return new Intl.NumberFormat(locale).format(n);
}

/**
 * Pluralize a noun based on count. Returns "{count} {singular|plural}".
 * If plural omitted, appends "s".
 */
export function pluralize(count: number, singular: string, plural?: string): string {
  const word = count === 1 ? singular : (plural ?? `${singular}s`);
  return `${formatNumber(count)} ${word}`;
}

/** Format a percentage with 1 decimal */
export function formatPercent(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`;
}

/** Format file size in human-readable units */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

/** Format minutes into "Xh Ym" */
export function formatMinutesToHM(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}m`;
}

/** Capitalize first letter */
export function capitalize(str: string): string {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

/** Convert SNAKE_CASE to Title Case */
export function snakeToTitle(str: string): string {
  return str
    .split("_")
    .map((word) => capitalize(word))
    .join(" ");
}

/** Format a user's full name from firstName + lastName */
export function formatName(firstName: string, lastName?: string | null): string {
  return lastName ? `${firstName} ${lastName}` : firstName;
}

/** Get initials from a name (up to 2 letters) */
export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
  return (parts[0]?.slice(0, 2) ?? "").toUpperCase();
}

/** Truncate a string to a max length with ellipsis */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + "...";
}
