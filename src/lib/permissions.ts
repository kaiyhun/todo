/**
 * Workspace permission rules.
 *
 * The model is deliberately **loose**: roles gate *people management* only.
 * Every member can do all content work — create, edit, move and delete epics and
 * tasks. This suits a small, trusted team and keeps the actions simple.
 *
 * Pure (type-only imports), so Client Components can use the same predicates to
 * hide controls that the Server Actions independently enforce. Hiding a button is
 * never the security boundary — the action always re-checks.
 */
import type { Workspace, WorkspaceRole } from "./models/workspace";

/** Rank used to sort a member list: owner, then admins, then members. */
export const ROLE_RANK: Record<WorkspaceRole, number> = {
  owner: 0,
  admin: 1,
  member: 2,
};

export const ROLE_LABELS: Record<WorkspaceRole, string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
};

/** The caller's role in a workspace, or `null` when they aren't a member. */
export function findWorkspaceRole(
  workspace: Workspace,
  userId: string,
): WorkspaceRole | null {
  return workspace.members.find((member) => member.userId === userId)?.role ?? null;
}

/** Add/remove members and change their roles. */
export function canManageMembers(role: WorkspaceRole | null): boolean {
  return role === "owner" || role === "admin";
}

/** Only the owner may hand the workspace to someone else. */
export function canTransferOwnership(role: WorkspaceRole | null): boolean {
  return role === "owner";
}

/**
 * Whether `actorRole` may change or remove the member holding `targetRole`.
 * Nobody may act on the owner — ownership moves only via an explicit transfer.
 */
export function canActOnMember(
  actorRole: WorkspaceRole | null,
  targetRole: WorkspaceRole,
): boolean {
  if (targetRole === "owner") return false;
  return canManageMembers(actorRole);
}
