/**
 * Workspace data-access helpers (Node.js runtime).
 */
import { ObjectId } from "mongodb";
import { workspacesCollection } from "@/lib/db/collections";
import { slugify, toObjectId } from "@/lib/models/common";
import { DEFAULT_TIMEZONE } from "@/lib/timezone";
import type { WorkspaceDoc } from "@/lib/models/workspace";

/** Cookie holding the user's currently-selected workspace id. */
export const ACTIVE_WORKSPACE_COOKIE = "active_workspace";

/** How many workspaces one user may own (create). Being *added* to others is uncapped. */
export const MAX_WORKSPACES_PER_USER = 3;

/** Every workspace the given user is a member of (any role). */
export async function getWorkspacesForUser(
  userId: string,
): Promise<WorkspaceDoc[]> {
  return workspacesCollection()
    .find({ "members.userId": toObjectId(userId) })
    .toArray();
}

/** How many workspaces the given user owns — the value the create limit checks. */
export async function countOwnedWorkspaces(userId: string): Promise<number> {
  return workspacesCollection().countDocuments({
    members: { $elemMatch: { userId: toObjectId(userId), role: "owner" } },
  });
}

/** Whether `userId` is the owner of `doc`. */
export function isWorkspaceOwner(doc: WorkspaceDoc, userId: string): boolean {
  return doc.members.some(
    (member) => member.userId.toString() === userId && member.role === "owner",
  );
}

/**
 * Create a workspace owned by `userId`. Guarantees a unique slug by appending a
 * numeric suffix on collision (`acme`, `acme-2`, …).
 */
export async function createWorkspaceForUser(
  name: string,
  userId: string,
): Promise<WorkspaceDoc> {
  const workspaces = workspacesCollection();

  const base = slugify(name) || "workspace";
  let slug = base;
  let suffix = 1;
  while (await workspaces.findOne({ slug })) {
    suffix += 1;
    slug = `${base}-${suffix}`;
  }

  const now = new Date();
  const doc: WorkspaceDoc = {
    _id: new ObjectId(),
    name: name.trim(),
    slug,
    // The server can't know the creator's zone; the owner sets it in Settings.
    timezone: DEFAULT_TIMEZONE,
    members: [{ userId: toObjectId(userId), role: "owner", joinedAt: now }],
    createdAt: now,
    updatedAt: now,
  };
  await workspaces.insertOne(doc);
  return doc;
}
