"use server";

/**
 * Server Actions for the current user's own profile.
 *
 * Unlike the member actions, these are self-service and need no role check — a
 * user may always edit their own name and password. Identity still comes from
 * the session (`requireUser`), never from client input, so there is no way to
 * act on another account.
 */
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { unstable_update } from "@/auth";
import { isLocalMode } from "@/lib/auth/local-mode";
import { usersCollection } from "@/lib/db/collections";
import { toObjectId } from "@/lib/models/common";
import { changePasswordSchema, updateProfileSchema } from "@/lib/models/user";
import { hashPassword, verifyPassword } from "@/lib/auth/credentials";
import type { ActionResult } from "./types";

/** Rename the current user. */
export async function updateProfileAction(
  input: unknown,
): Promise<ActionResult> {
  const user = await requireUser();

  const parsed = updateProfileSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid profile",
    };
  }
  const { name } = parsed.data;

  await usersCollection().updateOne(
    { _id: toObjectId(user.id) },
    { $set: { name, updatedAt: new Date() } },
  );

  // In LOCAL_MODE the name is read straight from the DB on every request, so the
  // update above is enough. Otherwise the display name lives in the JWT — push it
  // into the token so the sidebar refreshes without forcing a re-login.
  if (!isLocalMode()) {
    await unstable_update({ user: { name } });
  }

  // The name shows in the sidebar (rendered by the app layout) and on the board.
  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * Change the current user's password. Unavailable in LOCAL_MODE, where the
 * singleton user has no password and auth is switched off entirely.
 */
export async function changePasswordAction(
  input: unknown,
): Promise<ActionResult> {
  if (isLocalMode()) {
    return { ok: false, error: "Passwords are disabled in local mode" };
  }

  const user = await requireUser();

  const parsed = changePasswordSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid password",
    };
  }
  const { currentPassword, newPassword } = parsed.data;

  // Re-read the doc: the session never carries the hash, and we must confirm the
  // current password before allowing a change.
  const doc = await usersCollection().findOne({ _id: toObjectId(user.id) });
  if (!doc?.passwordHash) {
    return { ok: false, error: "This account has no password set" };
  }

  const valid = await verifyPassword(currentPassword, doc.passwordHash);
  if (!valid) {
    return { ok: false, error: "Current password is incorrect" };
  }

  const passwordHash = await hashPassword(newPassword);
  await usersCollection().updateOne(
    { _id: doc._id },
    { $set: { passwordHash, updatedAt: new Date() } },
  );

  return { ok: true };
}
