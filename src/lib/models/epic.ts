/**
 * Epic model — a large piece of work that is broken down into Tasks.
 *
 * On the sprint board an epic is a **row**: it renders in the leading "Epic"
 * column, and the tasks it owns are the cards laid out across the four status
 * columns to its right. An epic never sits in a status column itself — its
 * status is *derived* from its tasks (see `rollupEpicStatus`).
 *
 * An epic with `sprintId === null` is in the backlog (not scheduled).
 */
import { z } from "zod";
import type { ObjectId } from "mongodb";
import { objectIdSchema, serializeDate, type BaseDoc } from "./common";
import { PRIORITIES, type Priority } from "./enums";

/** An epic as stored in the `epics` collection. */
export interface EpicDoc extends BaseDoc {
  workspaceId: ObjectId;
  /** `null` means the epic is in the backlog (not assigned to a sprint). */
  sprintId: ObjectId | null;
  title: string;
  description?: string;
  priority: Priority;
  assigneeIds: ObjectId[];
  reporterId: ObjectId;
  labels: string[];
  /** Sort key for the epic's row within its sprint, ascending. */
  order: number;
  dueDate?: Date | null;
}

/** JSON-safe epic DTO. */
export interface Epic {
  id: string;
  workspaceId: string;
  sprintId: string | null;
  title: string;
  description?: string;
  priority: Priority;
  assigneeIds: string[];
  reporterId: string;
  labels: string[];
  order: number;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export function serializeEpic(doc: EpicDoc): Epic {
  return {
    id: doc._id.toString(),
    workspaceId: doc.workspaceId.toString(),
    sprintId: doc.sprintId ? doc.sprintId.toString() : null,
    title: doc.title,
    description: doc.description,
    priority: doc.priority,
    assigneeIds: doc.assigneeIds.map((id) => id.toString()),
    reporterId: doc.reporterId.toString(),
    labels: doc.labels,
    order: doc.order,
    dueDate: serializeDate(doc.dueDate),
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

// The epic's derived status + progress live in `./epic-progress` — pure
// functions with no zod/Mongo imports, so the board's Client Components can
// recompute the badge live during a drag using the same rule as the server.

// ---------------------------------------------------------------------------
// Input schemas
// ---------------------------------------------------------------------------

const optionalDate = z
  .string()
  .optional()
  .transform((v) => (v ? new Date(v) : null));

export const createEpicSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  description: z.string().trim().max(10_000).optional(),
  priority: z.enum(PRIORITIES).default("medium"),
  /** Omit or pass null to create the epic in the backlog. */
  sprintId: objectIdSchema.nullable().optional(),
  assigneeIds: z.array(objectIdSchema).default([]),
  labels: z.array(z.string().trim().min(1).max(40)).default([]),
  dueDate: optionalDate,
});
export type CreateEpicInput = z.infer<typeof createEpicSchema>;

export const updateEpicSchema = createEpicSchema.partial();
export type UpdateEpicInput = z.infer<typeof updateEpicSchema>;
