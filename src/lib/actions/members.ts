"use server";

/**
 * Server Actions for workspace membership.
 *
 * Permissions are **loose** (see `lib/permissions.ts`): roles gate people
 * management only. Every check here is re-evaluated server-side — the UI hides
 * controls as a courtesy, never as the boundary.
 *
 * There is no mail provider, so a teammate must register an account first and is
 * then added by email.
 */
import { revalidatePath } from "next/cache";
import { requireContext } from "@/lib/session";
import {
  epicsCollection,
  tasksCollection,
  usersCollection,
  workspacesCollection,
} from "@/lib/db/collections";
import { isValidObjectId, toObjectId } from "@/lib/models/common";
import {
  addMemberSchema,
  updateMemberRoleSchema,
} from "@/lib/models/workspace";
import {
  canActOnMember,
  canManageMembers,
  canTransferOwnership,
} from "@/lib/permissions";
import type { ActionResult } from "./types";

/** Member changes affect the members page and every avatar on the board/list. */
function revalidateMemberViews(): void {
  revalidatePath("/members");
  revalidatePath("/board");
  revalidatePath("/tasks");
}

/**
 * Add an already-registered user to the workspace as a `member`.
 *
 * The `members.userId: { $ne }` guard in the update filter makes the
 * "already a member" check atomic — two concurrent adds can't both succeed.
 */
export async function addMemberAction(input: unknown): Promise<ActionResult> {
  const { workspace, role } = await requireContext();
  if (!canManageMembers(role)) {
    return { ok: false, error: "You don't have permission to add members" };
  }

  const parsed = addMemberSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid email" };
  }
  const { email } = parsed.data;

  const user = await usersCollection().findOne({ email });
  if (!user) {
    return {
      ok: false,
      error: "No account with that email. Ask them to sign up first.",
    };
  }

  if (workspace.members.some((member) => member.userId === user._id.toString())) {
    return { ok: false, error: `${user.name} is already a member` };
  }

  const now = new Date();
  const result = await workspacesCollection().updateOne(
    { _id: toObjectId(workspace.id), "members.userId": { $ne: user._id } },
    {
      $push: { members: { userId: user._id, role: "member", joinedAt: now } },
      $set: { updatedAt: now },
    },
  );
  if (result.modifiedCount === 0) {
    return { ok: false, error: `${user.name} is already a member` };
  }

  revalidateMemberViews();
  return { ok: true };
}

/** Promote a member to admin, or demote an admin to member. Never touches the owner. */
export async function updateMemberRoleAction(
  input: unknown,
): Promise<ActionResult> {
  const { workspace, role } = await requireContext();
  if (!canManageMembers(role)) {
    return { ok: false, error: "You don't have permission to change roles" };
  }

  const parsed = updateMemberRoleSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid role" };
  }
  const { userId, role: nextRole } = parsed.data;

  const target = workspace.members.find((member) => member.userId === userId);
  if (!target) return { ok: false, error: "Not a member of this workspace" };

  if (!canActOnMember(role, target.role)) {
    return {
      ok: false,
      error: "The owner's role can't be changed — transfer ownership instead",
    };
  }

  await workspacesCollection().updateOne(
    { _id: toObjectId(workspace.id), "members.userId": toObjectId(userId) },
    { $set: { "members.$.role": nextRole, updatedAt: new Date() } },
  );

  revalidateMemberViews();
  return { ok: true };
}

/**
 * Remove a member and unassign them from every task and epic in the workspace, so
 * no dangling assignee ids are left behind.
 */
export async function removeMemberAction(userId: string): Promise<ActionResult> {
  const { user, workspace, role } = await requireContext();
  if (!canManageMembers(role)) {
    return { ok: false, error: "You don't have permission to remove members" };
  }
  if (!isValidObjectId(userId)) return { ok: false, error: "Invalid member id" };
  if (userId === user.id) {
    return { ok: false, error: "You can't remove yourself" };
  }

  const target = workspace.members.find((member) => member.userId === userId);
  if (!target) return { ok: false, error: "Not a member of this workspace" };

  if (!canActOnMember(role, target.role)) {
    return {
      ok: false,
      error: "The owner can't be removed — transfer ownership first",
    };
  }

  const workspaceObjectId = toObjectId(workspace.id);
  const userObjectId = toObjectId(userId);

  await workspacesCollection().updateOne(
    { _id: workspaceObjectId },
    {
      $pull: { members: { userId: userObjectId } },
      $set: { updatedAt: new Date() },
    },
  );

  // Drop them from every assignment in this workspace.
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

  revalidateMemberViews();
  return { ok: true };
}

/**
 * Hand the workspace to another member. The new owner is promoted and the current
 * owner steps down to admin — in a single atomic update via `arrayFilters`, so
 * the workspace is never left with zero or two owners.
 */
export async function transferOwnershipAction(
  userId: string,
): Promise<ActionResult> {
  const { user, workspace, role } = await requireContext();
  if (!canTransferOwnership(role)) {
    return { ok: false, error: "Only the owner can transfer ownership" };
  }
  if (!isValidObjectId(userId)) return { ok: false, error: "Invalid member id" };
  if (userId === user.id) return { ok: false, error: "You're already the owner" };

  const target = workspace.members.find((member) => member.userId === userId);
  if (!target) return { ok: false, error: "Not a member of this workspace" };

  await workspacesCollection().updateOne(
    { _id: toObjectId(workspace.id) },
    {
      $set: {
        "members.$[next].role": "owner",
        "members.$[current].role": "admin",
        updatedAt: new Date(),
      },
    },
    {
      arrayFilters: [
        { "next.userId": toObjectId(userId) },
        { "current.userId": toObjectId(user.id) },
      ],
    },
  );

  revalidateMemberViews();
  return { ok: true };
}
