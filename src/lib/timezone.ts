/**
 * IANA timezone helpers. Pure (Intl only), so both the server and Client
 * Components can use them.
 */

/** Used when a workspace has never had one set, and as the fallback for bad input. */
export const DEFAULT_TIMEZONE = "UTC";

/** Whether the runtime recognises this IANA zone name. */
export function isValidTimeZone(timeZone: string): boolean {
  if (!timeZone) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

/**
 * Every zone the runtime knows (~418). Available in Node ≥ 18 and every modern
 * browser; falls back to a single entry on anything older.
 */
export function listTimeZones(): string[] {
  const supported = Intl.supportedValuesOf?.("timeZone");
  return supported ? [...supported] : [DEFAULT_TIMEZONE];
}

/**
 * The zone's current abbreviation, e.g. `PDT` — shown next to each option so a
 * picker isn't 418 indistinguishable strings.
 */
export function timeZoneAbbreviation(timeZone: string, at: Date = new Date()): string {
  if (!isValidTimeZone(timeZone)) return "";
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "short",
  }).formatToParts(at);
  return parts.find((part) => part.type === "timeZoneName")?.value ?? "";
}
