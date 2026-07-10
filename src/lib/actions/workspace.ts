"use server";

/**
 * Server Actions for workspace settings.
 *
 * Gated by `canManageMembers` — the owner and admins. As everywhere else, the UI
 * hides the controls as a courtesy and this action is the actual boundary.
 */
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { requireContext, requireUser } from "@/lib/session";
import {
  epicsCollection,
  tasksCollection,
  workspacesCollection,
} from "@/lib/db/collections";
import { isValidObjectId, toObjectId } from "@/lib/models/common";
import {
  createWorkspaceSchema,
  updateWorkspaceSchema,
} from "@/lib/models/workspace";
import {
  ACTIVE_WORKSPACE_COOKIE,
  MAX_WORKSPACES_PER_USER,
  countOwnedWorkspaces,
  createWorkspaceForUser,
} from "@/lib/workspace";
import { canManageMembers } from "@/lib/permissions";
import type { ActionResult } from "./types";

/** A year — the active-workspace choice should persist across sessions. */
const WORKSPACE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

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

/**
 * Create a new workspace owned by the caller, capped at
 * `MAX_WORKSPACES_PER_USER` *owned* workspaces, and switch to it. The count is a
 * soft limit (no cross-request lock) — fine for a per-user click.
 */
export async function createWorkspaceAction(
  input: unknown,
): Promise<ActionResult> {
  const user = await requireUser();

  const parsed = createWorkspaceSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid workspace name",
    };
  }

  const owned = await countOwnedWorkspaces(user.id);
  if (owned >= MAX_WORKSPACES_PER_USER) {
    return {
      ok: false,
      error: `You can create at most ${MAX_WORKSPACES_PER_USER} workspaces`,
    };
  }

  const doc = await createWorkspaceForUser(parsed.data.name, user.id);

  // Land on the new workspace immediately.
  (await cookies()).set(ACTIVE_WORKSPACE_COOKIE, doc._id.toString(), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: WORKSPACE_COOKIE_MAX_AGE,
  });

  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * Switch the active workspace. Validates that the caller actually belongs to the
 * target before writing the cookie that `getCurrentContext` reads.
 */
export async function switchWorkspaceAction(
  workspaceId: string,
): Promise<ActionResult> {
  const user = await requireUser();
  if (!isValidObjectId(workspaceId)) {
    return { ok: false, error: "Invalid workspace" };
  }

  const target = await workspacesCollection().findOne({
    _id: toObjectId(workspaceId),
    "members.userId": toObjectId(user.id),
  });
  if (!target) {
    return { ok: false, error: "You're not a member of that workspace" };
  }

  (await cookies()).set(ACTIVE_WORKSPACE_COOKIE, workspaceId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: WORKSPACE_COOKIE_MAX_AGE,
  });

  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * Leave the current workspace. The owner can't leave (they must transfer
 * ownership first); anyone else is removed from the roster and unassigned from
 * every task and epic, mirroring `removeMemberAction`.
 */
export async function leaveWorkspaceAction(): Promise<ActionResult> {
  const { user, workspace, role } = await requireContext();
  if (role === "owner") {
    return {
      ok: false,
      error: "Transfer ownership before leaving — a workspace can't be left ownerless",
    };
  }

  const workspaceObjectId = toObjectId(workspace.id);
  const userObjectId = toObjectId(user.id);

  await workspacesCollection().updateOne(
    { _id: workspaceObjectId },
    {
      $pull: { members: { userId: userObjectId } },
      $set: { updatedAt: new Date() },
    },
  );

  await Promise.all([
    tasksCollection().updateMany(
      { workspaceId: workspaceObjectId },
      { $pull: { assigneeIds: userObjectId } },
    ),
    epicsCollection().updateMany(
      { workspaceId: workspaceObjectId },
      { $pull: { assigneeIds: userObjectId } },
    ),
  ]);

  // Drop the cookie so we don't keep pointing at the workspace just left; the
  // next context resolve falls back to a workspace the user owns.
  (await cookies()).delete(ACTIVE_WORKSPACE_COOKIE);

  revalidatePath("/", "layout");
  return { ok: true };
}
