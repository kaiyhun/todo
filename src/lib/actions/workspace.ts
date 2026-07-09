"use server";

/**
 * Server Actions for workspace settings.
 *
 * Gated by `canManageMembers` — the owner and admins. As everywhere else, the UI
 * hides the controls as a courtesy and this action is the actual boundary.
 */
import { revalidatePath } from "next/cache";
import { requireContext } from "@/lib/session";
import { workspacesCollection } from "@/lib/db/collections";
import { toObjectId } from "@/lib/models/common";
import { updateWorkspaceSchema } from "@/lib/models/workspace";
import { canManageMembers } from "@/lib/permissions";
import type { ActionResult } from "./types";

export async function updateWorkspaceAction(
  input: unknown,
): Promise<ActionResult> {
  const { workspace, role } = await requireContext();
  if (!canManageMembers(role)) {
    return { ok: false, error: "You don't have permission to change settings" };
  }

  const parsed = updateWorkspaceSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid settings",
    };
  }
  const patch = parsed.data;

  // Built from defined keys only — the Mongo driver serialises `undefined` as null.
  const set: Record<string, unknown> = { updatedAt: new Date() };
  if (patch.name !== undefined) set.name = patch.name;
  if (patch.timezone !== undefined) set.timezone = patch.timezone;

  await workspacesCollection().updateOne(
    { _id: toObjectId(workspace.id) },
    { $set: set },
  );

  // The timezone changes how *every* date in the app renders, and the name shows
  // in the sidebar — revalidate the whole tree rather than a single route.
  revalidatePath("/", "layout");
  return { ok: true };
}
