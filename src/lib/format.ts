/**
 * Presentation helpers.
 *
 * Every date is rendered **in the workspace's timezone**, which is passed in
 * explicitly rather than read from the ambient environment. That matters twice
 * over: the server and browser have different ambient zones (a hydration
 * mismatch), and a team needs one agreed clock regardless of where each member
 * happens to be sitting.
 *
 * Server Components take the timezone from `requireContext()`; Client Components
 * read it from `useTimezone()`.
 */
import { DEFAULT_TIMEZONE, isValidTimeZone } from "./timezone";

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

// `Intl.DateTimeFormat` construction is comparatively expensive, and these are
// hit once per table row. Cache one formatter per (kind, timezone).
const formatterCache = new Map<string, Intl.DateTimeFormat>();

function formatter(kind: string, timeZone: string, options: Intl.DateTimeFormatOptions) {
  const key = `${kind}:${timeZone}`;
  let cached = formatterCache.get(key);
  if (!cached) {
    cached = new Intl.DateTimeFormat("en-US", { ...options, timeZone });
    formatterCache.set(key, cached);
  }
  return cached;
}

function safeZone(timeZone: string | undefined): string {
  return timeZone && isValidTimeZone(timeZone) ? timeZone : DEFAULT_TIMEZONE;
}

/** e.g. "Jul 20, 2026" — an em dash when null. */
export function formatDate(
  iso: string | null | undefined,
  timeZone: string,
): string {
  if (!iso) return "—";
  return formatter("date", safeZone(timeZone), {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(iso));
}

/** e.g. "Jul 9, 2026 at 4:32 PM PDT" — an em dash when null. */
export function formatDateTime(
  iso: string | null | undefined,
  timeZone: string,
): string {
  if (!iso) return "—";
  const zone = safeZone(timeZone);
  const date = new Date(iso);

  const day = formatter("date", zone, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);

  // `timeZoneName` cannot be combined with `dateStyle`/`timeStyle`, hence the
  // two formatters rather than one.
  const time = formatter("time", zone, {
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(date);

  return `${day} at ${time}`;
}

/**
 * The `YYYY-MM-DD` value for an `<input type="date">`, as seen in `timeZone`.
 *
 * Uses the `en-CA` locale because it formats as ISO order — the exact shape the
 * input element requires.
 */
export function toDateInputValue(
  iso: string | null | undefined,
  timeZone: string,
): string {
  if (!iso) return "";
  const zone = safeZone(timeZone);
  const key = `input:${zone}`;

  let cached = formatterCache.get(key);
  if (!cached) {
    cached = new Intl.DateTimeFormat("en-CA", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      timeZone: zone,
    });
    formatterCache.set(key, cached);
  }
  return cached.format(new Date(iso));
}
