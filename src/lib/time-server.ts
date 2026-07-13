/**
 * Wall-clock → UTC instant conversion. **Server only.**
 *
 * This is the write half of the timezone story, and it cannot be skipped:
 * `new Date("2026-07-20T19:00")` parses a wall clock in the *runtime's* timezone,
 * which on Vercel is UTC. Storing that would mean a 7:00 PM PT deadline is written
 * as 19:00 UTC (= noon PT) — and no read-side formatter can recover the intent,
 * because the wrong instant was persisted. The bug is invisible in local dev
 * whenever the developer's machine happens to sit in the project timezone.
 *
 * `Temporal` is not yet in Node 22, so the polyfill does the zone arithmetic —
 * including DST gaps (a zone where midnight doesn't exist) and half-hour offsets.
 * It lives behind `server-only` so its ~200 KB never enters the browser bundle.
 */
import "server-only";
import { Temporal } from "@js-temporal/polyfill";
import { DEFAULT_TIMEZONE, isValidTimeZone } from "./timezone";

/** `YYYY-MM-DD`, exactly what `<input type="date">` produces. */
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** The last representable millisecond of a day. */
const END_OF_DAY = Temporal.PlainTime.from("23:59:59.999");

/** The first instant of a day (shifts forward on a DST gap, like the end helper). */
const START_OF_DAY = Temporal.PlainTime.from("00:00:00");

/**
 * Interpret a calendar date as **the start of that day in `timeZone`** and return
 * the corresponding UTC instant — the mirror of {@link endOfDayInZone}, used for a
 * sprint's start date.
 */
export function startOfDayInZone(dateOnly: string, timeZone: string): Date {
  if (!DATE_ONLY.test(dateOnly)) {
    throw new Error(`Expected a YYYY-MM-DD date, received "${dateOnly}"`);
  }
  const zone = isValidTimeZone(timeZone) ? timeZone : DEFAULT_TIMEZONE;

  const zoned = Temporal.PlainDate.from(dateOnly).toZonedDateTime({
    timeZone: zone,
    plainTime: START_OF_DAY,
  });
  return new Date(zoned.toInstant().epochMilliseconds);
}

/**
 * Interpret a calendar date as **the end of that day in `timeZone`**, and return
 * the corresponding UTC instant.
 *
 * A due date of "Jul 20" means "any time on the 20th, in the project's timezone",
 * so the deadline is the final instant of that day there. Storing that makes
 * "is it overdue?" a plain instant comparison.
 */
export function endOfDayInZone(dateOnly: string, timeZone: string): Date {
  if (!DATE_ONLY.test(dateOnly)) {
    throw new Error(`Expected a YYYY-MM-DD date, received "${dateOnly}"`);
  }
  const zone = isValidTimeZone(timeZone) ? timeZone : DEFAULT_TIMEZONE;

  const zoned = Temporal.PlainDate.from(dateOnly).toZonedDateTime({
    timeZone: zone,
    plainTime: END_OF_DAY,
  });
  return new Date(zoned.toInstant().epochMilliseconds);
}

/**
 * Convert a due-date form value into the instant to store.
 * `null`/`""` clears the date; anything malformed is rejected by the caller.
 */
export function parseDueDate(
  value: string | null | undefined,
  timeZone: string,
): Date | null {
  if (!value) return null;
  return endOfDayInZone(value, timeZone);
}
