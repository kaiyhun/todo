/**
 * Request proxy (formerly "middleware" — renamed in Next.js 16).
 *
 * Runs on every matched request and enforces the `authorized` callback from
 * `authConfig`, redirecting unauthenticated users to the sign-in page. It uses
 * only the JWT, so it stays edge-compatible and never touches the database.
 */
import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

// NextAuth returns an `auth` wrapper usable directly as the request handler.
const { auth } = NextAuth(authConfig);

// Next.js 16 looks for a function exported as `proxy` (or a default export).
export { auth as proxy };

export const config = {
  /**
   * Match all application routes except Next internals, the auth API, and files
   * with an extension (static assets, images, etc.).
   */
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.).*)"],
};
