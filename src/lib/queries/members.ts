/**
 * Workspace member lookup, shared by the board (assignee avatars) and the tasks
 * table (assignee column + filter). Node.js runtime only.
 */
import "server-only";
import { usersCollection } from "@/lib/db/collections";
import { toObjectId } from "@/lib/models/common";
import type { BoardMember } from "@/lib/board-types";

/**
 * Resolve a workspace's member ids to display data, preserving the order in
 * which they appear on the workspace document. Unknown ids are skipped.
 */
export async function getWorkspaceMembers(
  memberIds: string[],
): Promise<BoardMember[]> {
  if (memberIds.length === 0) return [];

  const docs = await usersCollection()
    .find({ _id: { $in: memberIds.map((id) => toObjectId(id)) } })
    .toArray();

  const byId = new Map(docs.map((doc) => [doc._id.toString(), doc]));

  return memberIds.flatMap((id) => {
    const doc = byId.get(id);
    return doc ? [{ id, name: doc.name, image: doc.image }] : [];
  });
}
