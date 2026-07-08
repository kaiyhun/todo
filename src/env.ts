/**
 * Centralised, type-safe access to environment variables.
 *
 * All server-side configuration flows through this module so that a missing or
 * malformed variable fails fast with a clear message at import time instead of
 * surfacing as a confusing error deep inside a request.
 *
 * IMPORTANT: This module reads server-only secrets (e.g. `MONGODB_URI`) and must
 * never be imported from a Client Component or from the edge `proxy`. Server
 * code — route handlers, server actions, the Mongo layer and the full Auth.js
 * config — may import it freely. Edge/proxy code should read the few flags it
 * needs directly from `process.env` (see `lib/auth/local-mode.ts`).
 */
import { z } from "zod";

/** Coerce the strings "true"/"1" (case-insensitive-ish) into a real boolean. */
const booleanFromString = z
  .string()
  .optional()
  .transform((value) => value === "true" || value === "1");

const envSchema = z.object({
  /** MongoDB connection string — Atlas `mongodb+srv://…` or a local `mongodb://…`. */
  MONGODB_URI: z.string().min(1, "MONGODB_URI is required"),

  /**
   * Logical database name the app reads/writes. Defaulting to a dedicated name
   * (rather than the cluster default) keeps local/dev data isolated from prod.
   */
  MONGODB_DB: z.string().min(1).default("todo"),

  /**
   * Secret used by Auth.js to sign the JWT session cookie. Generate one with
   * `npx auth secret` or `openssl rand -base64 33`. Not needed in LOCAL_MODE
   * (auth is bypassed) but required for any hosted login.
   */
  AUTH_SECRET: z.string().min(1).optional(),

  /**
   * When true the app runs with authentication disabled — every request is
   * treated as one local user. Intended for offline / self-hosted single-player
   * use where a login screen would only get in the way.
   */
  LOCAL_MODE: booleanFromString,

  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
});

// Parse a single time at module load. On failure we throw immediately with a
// readable, path-annotated message rather than letting `undefined` leak onward.
const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `  • ${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join("\n");
  throw new Error(
    `Invalid environment configuration. Check your .env.local:\n${issues}`,
  );
}

/** Validated, strongly-typed server environment. */
export const env = parsed.data;
