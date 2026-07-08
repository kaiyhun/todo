/**
 * Small presentation helpers shared across components.
 */

/** First letters of the first two words, e.g. "Ada Lovelace" → "AL". */
export function getInitials(name: string): string {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]!.toUpperCase())
    .join("");
  return initials || "?";
}

/** Format an ISO date string as e.g. "Jul 8, 2026" (or an em dash when null). */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
