/**
 * Workspace data-access helpers (Node.js runtime).
 */
import { ObjectId } from "mongodb";
import { workspacesCollection } from "@/lib/db/collections";
import { slugify, toObjectId } from "@/lib/models/common";
import { DEFAULT_TIMEZONE } from "@/lib/timezone";
import type { WorkspaceDoc } from "@/lib/models/workspace";

/** The first workspace the given user is a member of, or `null`. */
export async function getWorkspaceForUser(
  userId: string,
): Promise<WorkspaceDoc | null> {
  return workspacesCollection().findOne({ "members.userId": toObjectId(userId) });
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
