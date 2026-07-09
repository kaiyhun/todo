/**
 * Workspace member lookup, shared by the board (assignee avatars) and the tasks
 * table (assignee column + filter). Node.js runtime only.
 */
import "server-only";
import { usersCollection } from "@/lib/db/collections";
import { toObjectId } from "@/lib/models/common";
import { ROLE_RANK } from "@/lib/permissions";
import type { Workspace } from "@/lib/models/workspace";
import type { BoardMember } from "@/lib/board-types";
import type { MemberRow } from "@/lib/member-types";

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

/**
 * The members table's data: each workspace membership joined with its user, and
 * sorted owner → admins → members, then alphabetically.
 *
 * A membership whose user no longer exists is dropped rather than rendered as a
 * ghost row.
 */
export async function getMemberDirectory(
  workspace: Workspace,
): Promise<MemberRow[]> {
  if (workspace.members.length === 0) return [];

  const docs = await usersCollection()
    .find({
      _id: { $in: workspace.members.map((member) => toObjectId(member.userId)) },
    })
    .toArray();

  const byId = new Map(docs.map((doc) => [doc._id.toString(), doc]));

  const rows: MemberRow[] = workspace.members.flatMap((member) => {
    const doc = byId.get(member.userId);
    if (!doc) return [];
    return [
      {
        id: member.userId,
        name: doc.name,
        email: doc.email,
        image: doc.image,
        role: member.role,
        joinedAt: member.joinedAt,
      },
    ];
  });

  return rows.sort(
    (a, b) =>
      ROLE_RANK[a.role] - ROLE_RANK[b.role] || a.name.localeCompare(b.name),
  );
}
