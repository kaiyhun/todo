/**
 * Full Auth.js setup (Node.js runtime).
 *
 * Spreads the edge-safe `authConfig` and attaches the Credentials provider,
 * whose `authorize` talks to MongoDB and bcrypt. Exports the handlers used by
 * the API route and the `auth`/`signIn`/`signOut` helpers used across the app.
 */
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "@/auth.config";
import { authorizeCredentials } from "@/lib/auth/credentials";

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      // The fields drive the default (unused) form; our own pages POST these.
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: authorizeCredentials,
    }),
  ],
});
