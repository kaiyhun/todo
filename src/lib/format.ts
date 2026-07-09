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

/**
 * Formats an ISO date string as e.g. "Jul 8, 2026" (or an em dash when null).
 *
 * Both the locale and the timezone are pinned, for two reasons:
 *
 * 1. **Correctness.** A due date is stored as UTC midnight (an `<input type="date">`
 *    value like `2026-07-20` parses to `2026-07-20T00:00:00Z`). Rendering it in the
 *    viewer's timezone shows "Jul 19" anywhere west of UTC.
 * 2. **Hydration.** This runs inside Client Components, which React renders on the
 *    server *and* again in the browser. `toLocaleDateString(undefined, …)` reads the
 *    ambient locale/timezone, which differ between the two — a guaranteed mismatch
 *    for anyone not on the server's settings.
 *
 * The trade-off: timestamps (`createdAt`/`updatedAt`) are shown as their UTC day,
 * which can differ by one from the reader's local day late in the evening.
 */
const DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return DATE_FORMATTER.format(new Date(iso));
}
