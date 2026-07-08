/**
 * Workspace model.
 *
 * A workspace is a team space that owns sprints, tasks and wiki pages. Members
 * are embedded on the document (small teams → a handful of members), each with a
 * per-workspace role controlling what they can administer.
 */
import { z } from "zod";
import type { ObjectId } from "mongodb";
import type { BaseDoc } from "./common";

export type WorkspaceRole = "owner" | "admin" | "member";

/** Embedded membership record. */
export interface WorkspaceMember {
  userId: ObjectId;
  role: WorkspaceRole;
  joinedAt: Date;
}

/** A workspace as stored in the `workspaces` collection. */
export interface WorkspaceDoc extends BaseDoc {
  name: string;
  /** Unique, URL-safe identifier used in links, e.g. `acme-team`. */
  slug: string;
  members: WorkspaceMember[];
}

/** JSON-safe workspace DTO. */
export interface Workspace {
  id: string;
  name: string;
  slug: string;
  members: Array<{ userId: string; role: WorkspaceRole; joinedAt: string }>;
}

export function serializeWorkspace(doc: WorkspaceDoc): Workspace {
  return {
    id: doc._id.toString(),
    name: doc.name,
    slug: doc.slug,
    members: doc.members.map((m) => ({
      userId: m.userId.toString(),
      role: m.role,
      joinedAt: m.joinedAt.toISOString(),
    })),
  };
}

/** Turn a free-text name into a URL-safe slug (`My Team!` → `my-team`). */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export const createWorkspaceSchema = z.object({
  name: z.string().trim().min(1, "Workspace name is required").max(80),
});
export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;
