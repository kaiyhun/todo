/**
 * LOCAL_MODE support.
 *
 * When `LOCAL_MODE` is enabled the app runs with authentication switched off:
 * every request is treated as a single, well-known local user. This is for
 * offline / self-hosted "just run it on my machine" use where a login screen
 * only gets in the way.
 *
 * This module is intentionally dependency-free (it reads `process.env` directly
 * rather than importing the validated `env`) so it is safe to use from the edge
 * `proxy` as well as from Node server code.
 */

/** Whether authentication is disabled. */
export function isLocalMode(): boolean {
  const value = process.env.LOCAL_MODE;
  return value === "true" || value === "1";
}

/**
 * Stable ids for the singleton local user and workspace. Using fixed ObjectIds
 * means data created across restarts always belongs to the same local identity.
 */
export const LOCAL_USER_ID = "000000000000000000000001";
export const LOCAL_WORKSPACE_ID = "000000000000000000000002";
export const LOCAL_USER_EMAIL = "local@todo.app";
export const LOCAL_USER_NAME = "Local User";
