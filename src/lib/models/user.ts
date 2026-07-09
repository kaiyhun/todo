/**
 * User model.
 *
 * Users authenticate with email + password (bcrypt-hashed). Because we use the
 * Auth.js Credentials provider with JWT sessions, users live entirely in this
 * `users` collection — there are no Auth.js `accounts`/`sessions` collections.
 */
import { z } from "zod";
import type { BaseDoc } from "./common";

/** Application-wide role (distinct from a per-workspace role). */
export type UserRole = "admin" | "member";

/** A user as stored in the `users` collection. */
export interface UserDoc extends BaseDoc {
  /** Unique, always stored lowercased. */
  email: string;
  name: string;
  /** bcrypt hash. Absent for the synthetic LOCAL_MODE user. Never sent to clients. */
  passwordHash?: string;
  /** Optional avatar URL; the UI falls back to initials when missing. */
  image?: string;
  role: UserRole;
}

/** User shape safe to expose to the browser — note: no `passwordHash`. */
export interface User {
  id: string;
  email: string;
  name: string;
  image?: string;
  role: UserRole;
}

/** Strip secrets and serialise ids for safe client transfer. */
export function serializeUser(doc: UserDoc): User {
  return {
    id: doc._id.toString(),
    email: doc.email,
    name: doc.name,
    image: doc.image,
    role: doc.role,
  };
}

/**
 * Email validator. We use an explicit refinement (rather than Zod's built-in
 * email format helper) to stay stable across Zod versions and to normalise the
 * value — trimmed + lowercased — before it is stored or compared.
 */
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .refine((v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "Enter a valid email address");

/** Input accepted by the registration action. */
export const registerSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  email: emailSchema,
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(200, "Password is too long"),
});
export type RegisterInput = z.infer<typeof registerSchema>;

/** Input accepted by the login form (validated again inside `authorize`). */
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required"),
});
export type LoginInput = z.infer<typeof loginSchema>;
