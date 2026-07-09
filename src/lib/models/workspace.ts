/**
 * Workspace model.
 *
 * A workspace is a team space that owns sprints, tasks and wiki pages. Members
 * are embedded on the document (small teams → a handful of members), each with a
 * per-workspace role controlling what they can administer.
 */
import { z } from "zod";
import type { ObjectId } from "mongodb";
import { objectIdSchema, type BaseDoc } from "./common";
import { emailSchema } from "./user";
import { DEFAULT_TIMEZONE, isValidTimeZone } from "@/lib/timezone";

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
  /**
   * IANA timezone (e.g. `America/Vancouver`) — the project's agreed clock.
   *
   * Every instant is stored in UTC and rendered through this zone, and a due date
   * picked in the UI is interpreted as the end of that day *here*. It is the one
   * timezone the whole team shares, regardless of where each member sits.
   */
  timezone: string;
  members: WorkspaceMember[];
}

/** JSON-safe workspace DTO. */
export interface Workspace {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  members: Array<{ userId: string; role: WorkspaceRole; joinedAt: string }>;
}

export function serializeWorkspace(doc: WorkspaceDoc): Workspace {
  return {
    id: doc._id.toString(),
    name: doc.name,
    slug: doc.slug,
    // Tolerate workspaces created before the field existed.
    timezone: doc.timezone ?? DEFAULT_TIMEZONE,
    members: doc.members.map((m) => ({
      userId: m.userId.toString(),
      role: m.role,
      joinedAt: m.joinedAt.toISOString(),
    })),
  };
}

export const createWorkspaceSchema = z.object({
  name: z.string().trim().min(1, "Workspace name is required").max(80),
});
export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;

/** Workspace settings. Absent means "leave unchanged". */
export const updateWorkspaceSchema = z.object({
  name: z.string().trim().min(1, "Workspace name is required").max(80).optional(),
  timezone: z
    .string()
    .refine(isValidTimeZone, "Unknown timezone")
    .optional(),
});
export type UpdateWorkspaceInput = z.infer<typeof updateWorkspaceSchema>;

// ---------------------------------------------------------------------------
// Membership
// ---------------------------------------------------------------------------

/** Add a teammate who has already registered an account. */
export const addMemberSchema = z.object({
  email: emailSchema,
});
export type AddMemberInput = z.infer<typeof addMemberSchema>;

/**
 * `owner` is intentionally absent: ownership never moves through a role change,
 * only through an explicit transfer.
 */
export const updateMemberRoleSchema = z.object({
  userId: objectIdSchema,
  role: z.enum(["admin", "member"]),
});
export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleSchema>;

export const memberIdSchema = z.object({ userId: objectIdSchema });
