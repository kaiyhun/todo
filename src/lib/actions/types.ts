/**
 * Shared result types for Server Actions.
 *
 * Actions never throw for expected failures — they return a discriminated union
 * so the caller can surface a message and roll back optimistic UI.
 *
 * This lives in its own module because a `"use server"` file may only export
 * async functions.
 */

/** An action that returns nothing on success. */
export type ActionResult = { ok: true } | { ok: false; error: string };

/** An action that returns a payload on success. */
export type ActionResultWith<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };
