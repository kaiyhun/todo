/**
 * Task model — a unit of work that lives inside an Epic and moves across the
 * board's status columns.
 *
 * Board geometry: rows are Epics, columns are the four statuses below. A task is
 * therefore addressed by the cell `(epicId, status)`, and `order` sorts the
 * cards within that cell. Dragging a card changes its `status` (horizontal) and
 * may also change its `epicId` (vertical → re-parent to another epic).
 */
import { z } from "zod";
import type { ObjectId } from "mongodb";
import { objectIdSchema, serializeDate, type BaseDoc } from "./common";
import {
  PRIORITIES,
  TASK_STATUSES,
  type Priority,
  type TaskStatus,
} from "./enums";

/** A task as stored in the `tasks` collection. */
export interface TaskDoc extends BaseDoc {
  workspaceId: ObjectId;
  /** Parent epic — every task belongs to exactly one epic (its board row). */
  epicId: ObjectId;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: Priority;
  /** Member assignments (a task may have zero or more assignees). */
  assigneeIds: ObjectId[];
  /** The user who created the task. */
  reporterId: ObjectId;
  labels: string[];
  /** Sort key within the task's `(epicId, status)` cell, ascending. */
  order: number;
  dueDate?: Date | null;
}

/** JSON-safe task DTO for Client Components (board cards, lists, detail views). */
export interface Task {
  id: string;
  workspaceId: string;
  epicId: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: Priority;
  assigneeIds: string[];
  reporterId: string;
  labels: string[];
  order: number;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export function serializeTask(doc: TaskDoc): Task {
  return {
    id: doc._id.toString(),
    workspaceId: doc.workspaceId.toString(),
    epicId: doc.epicId.toString(),
    title: doc.title,
    description: doc.description,
    status: doc.status,
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

/** Accepts a `datetime-local`/ISO string or nothing, coerced to a Date. */
const optionalDate = z
  .string()
  .optional()
  .transform((v) => (v ? new Date(v) : null));

/** Fields accepted when creating a task. The server fills in reporter + order. */
export const createTaskSchema = z.object({
  epicId: objectIdSchema,
  title: z.string().trim().min(1, "Title is required").max(200),
  description: z.string().trim().max(10_000).optional(),
  status: z.enum(TASK_STATUSES).default("new"),
  priority: z.enum(PRIORITIES).default("medium"),
  assigneeIds: z.array(objectIdSchema).default([]),
  labels: z.array(z.string().trim().min(1).max(40)).default([]),
  dueDate: optionalDate,
});
export type CreateTaskInput = z.infer<typeof createTaskSchema>;

/**
 * Fields accepted when editing a task. Every field is optional and **absent means
 * "leave unchanged"**.
 *
 * Deliberately spelled out rather than derived via `createTaskSchema.partial()`:
 * the create schema's `.default()`s would silently reset omitted fields, and its
 * `dueDate` transform cannot distinguish "not provided" from "cleared". Here
 * `dueDate` stays a raw string so the action can tell `undefined` (leave alone)
 * apart from `null`/`""` (clear it).
 */
export const updateTaskSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200).optional(),
  description: z.string().trim().max(10_000).optional(),
  status: z.enum(TASK_STATUSES).optional(),
  priority: z.enum(PRIORITIES).optional(),
  /** Moving a task to another epic re-parents it — same as a vertical drag. */
  epicId: objectIdSchema.optional(),
  assigneeIds: z.array(objectIdSchema).optional(),
  labels: z.array(z.string().trim().min(1).max(40)).optional(),
  dueDate: z.string().nullable().optional(),
});
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;

/**
 * Payload for a board drag.
 *
 * `orderedIds` is the destination cell's complete, final list of task ids
 * (including the moved task). The server rewrites `order` from that array's
 * indices, which sidesteps fractional-index drift entirely — cells hold only a
 * handful of cards, so rewriting them is cheap.
 */
export const moveTaskSchema = z.object({
  taskId: objectIdSchema,
  /** Destination epic — differs from the current one when re-parenting. */
  toEpicId: objectIdSchema,
  /** Destination column. */
  toStatus: z.enum(TASK_STATUSES),
  orderedIds: z.array(objectIdSchema).min(1),
});
export type MoveTaskInput = z.infer<typeof moveTaskSchema>;
