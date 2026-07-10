/**
 * Edge-safe Auth.js configuration.
 *
 * This file must NOT import anything that pulls in Node-only modules (bcrypt,
 * the Mongo driver, …) because it is consumed by the edge `proxy`. It holds the
 * pieces that can run anywhere: page routes, JWT/session shaping, and the
 * `authorized` route-protection callback. The Credentials provider — which needs
 * the database — is added later in `auth.ts` (Node runtime only).
 *
 * Pattern reference: https://authjs.dev/guides/edge-compatibility
 */
import type { NextAuthConfig } from "next-auth";
import type { UserRole } from "@/lib/models/user";
import { isLocalMode } from "@/lib/auth/local-mode";

/** Route prefixes that require an authenticated user. */
const PROTECTED_PREFIXES = [
  "/dashboard",
  "/board",
  "/tasks",
  "/wiki",
  "/members",
  "/settings",
];

export const authConfig = {
  // We must sign our own JWTs (Credentials cannot use database sessions).
  session: { strategy: "jwt" },
  // Required for self-hosting / non-Vercel hosts to accept the request host.
  trustHost: true,
  pages: { signIn: "/login" },
  // Real providers are attached in auth.ts; the edge instance only reads JWTs.
  providers: [],
  callbacks: {
    /**
     * Route protection, evaluated by the proxy on every matched request using
     * only the JWT (no database access). Returning `false` bounces the user to
     * the sign-in page; a `Response.redirect` sends them elsewhere.
     */
    authorized({ auth, request: { nextUrl } }) {
      if (isLocalMode()) return true; // auth disabled — allow everything

      const isLoggedIn = Boolean(auth?.user);
      const { pathname } = nextUrl;
      const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
      const isAuthPage =
        pathname.startsWith("/login") || pathname.startsWith("/register");

      if (isProtected) return isLoggedIn;

      // Signed-in users have no reason to see the login/register pages.
      if (isAuthPage && isLoggedIn) {
        return Response.redirect(new URL("/dashboard", nextUrl));
      }
      return true;
    },

    /**
     * Shape the JWT. At sign-in we copy our custom fields off the authorized
     * user. On an `update` (triggered by `unstable_update` after a profile edit)
     * we merge the new display name into the token, so the signed-in user's name
     * refreshes everywhere without a re-login. `@auth/core` rebuilds the session's
     * `user.name` from `token.name`, so this assignment is what actually sticks.
     */
    jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id as string;
        token.role = (user as { role?: UserRole }).role ?? "member";
      }
      if (trigger === "update" && session && typeof session === "object") {
        const next = (session as { user?: { name?: unknown } }).user;
        if (typeof next?.name === "string") token.name = next.name;
      }
      return token;
    },

    /** Expose id + role on the session object read by the app. These come from
     *  the `jwt` callback above, so we assert their types on the way out. */
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as UserRole;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
