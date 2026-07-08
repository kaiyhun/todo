/**
 * Password hashing and the Credentials `authorize` implementation.
 *
 * This module runs only in the Node.js runtime (bcrypt + Mongo), never on the
 * edge. It is imported by `auth.ts`, not by `auth.config.ts`/`proxy.ts`.
 */
import bcrypt from "bcryptjs";
import { usersCollection } from "@/lib/db/collections";
import { loginSchema } from "@/lib/models/user";

/** Work factor for bcrypt. 12 is a sensible default for interactive logins. */
const BCRYPT_ROUNDS = 12;

/** Hash a plaintext password for storage. */
export async function hashPassword(plaintext: string): Promise<string> {
  return bcrypt.hash(plaintext, BCRYPT_ROUNDS);
}

/** Constant-time comparison of a plaintext password against a stored hash. */
export async function verifyPassword(
  plaintext: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(plaintext, hash);
}

/**
 * The Credentials provider's `authorize` callback.
 *
 * Returns a minimal user object on success (which becomes `user` in the `jwt`
 * callback) or `null` on any failure. We never reveal whether it was the email
 * or the password that was wrong.
 */
export async function authorizeCredentials(raw: unknown) {
  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) return null;

  const { email, password } = parsed.data;
  const user = await usersCollection().findOne({ email });
  if (!user?.passwordHash) return null;

  const passwordValid = await verifyPassword(password, user.passwordHash);
  if (!passwordValid) return null;

  return {
    id: user._id.toString(),
    email: user.email,
    name: user.name,
    image: user.image,
    role: user.role,
  };
}
