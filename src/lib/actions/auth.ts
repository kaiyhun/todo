"use server";

/**
 * Server Actions for authentication.
 *
 * These are called from the login/register forms via `useActionState`. Each
 * returns an `AuthFormState` (an optional error message) on failure; on success
 * `signIn`/`signOut` throw a redirect that Next.js turns into a navigation.
 */
import { ObjectId } from "mongodb";
import { AuthError } from "next-auth";
import { signIn, signOut } from "@/auth";
import { usersCollection } from "@/lib/db/collections";
import { registerSchema } from "@/lib/models/user";
import { hashPassword } from "@/lib/auth/credentials";
import { createWorkspaceForUser } from "@/lib/workspace";

/** Shape returned to the form; `undefined`/empty means "no error". */
export type AuthFormState = { error?: string } | undefined;

/**
 * Register a new account, create a starter workspace, then sign the user in and
 * redirect them to the dashboard.
 */
export async function registerAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid details" };
  }

  const { name, email, password } = parsed.data;
  const users = usersCollection();

  // Enforce unique email up front for a friendly message (the unique index is
  // the ultimate guard against races).
  if (await users.findOne({ email })) {
    return { error: "An account with that email already exists" };
  }

  const now = new Date();
  const _id = new ObjectId();
  try {
    await users.insertOne({
      _id,
      email,
      name,
      passwordHash: await hashPassword(password),
      role: "member",
      createdAt: now,
      updatedAt: now,
    });
  } catch {
    return { error: "An account with that email already exists" };
  }

  await createWorkspaceForUser(`${name}'s Workspace`, _id.toString());

  // Throws a redirect (NEXT_REDIRECT) on success — do not wrap in try/catch.
  await signIn("credentials", { email, password, redirectTo: "/dashboard" });
  return undefined;
}

/** Sign an existing user in. */
export async function loginAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: "/dashboard",
    });
  } catch (error) {
    // A failed credential check surfaces as an AuthError; everything else
    // (notably the NEXT_REDIRECT thrown on success) must be re-thrown.
    if (error instanceof AuthError) {
      return { error: "Invalid email or password" };
    }
    throw error;
  }
  return undefined;
}

/** Sign the current user out and return to the login page. */
export async function logoutAction(): Promise<void> {
  await signOut({ redirectTo: "/login" });
}
