/**
 * Cookie names for client-set UI preferences that the server also reads (for a
 * flash-free initial render). Kept in a plain module — importing these from a
 * `"use client"` file into a Server Component would hand back a client reference,
 * not the string value.
 */

/** "1" when the desktop sidebar is collapsed. */
export const SIDEBAR_COLLAPSED_COOKIE = "sidebar_collapsed";
