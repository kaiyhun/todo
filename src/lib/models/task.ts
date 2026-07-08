/**
 * Task model — the core work item.
 *
 * Tasks belong to a workspace and optionally to a sprint. `status` doubles as the
 * board column, and `order` is the sort key within a column so cards can be
 * re-ordered by drag-and-drop without renumbering siblings on every move.
 */
import { z } from "zod";
import type { ObjectId } from "mongodb";
import { serializeDate, type BaseDoc } from "./common";

/** Board columns, in display order. `status` is one of these values. */
export const TASK_STATUSES = [
  "backlog",
  "todo",
  "in_progress",
  "in_review",
  "done",
] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

/** Human-readable labels for each column/status. */
export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  backlog: "Backlog",
  todo: "To Do",
  in_progress: "In Progress",
  in_review: "In Review",
  done: "Done",
};

export const TASK_PRIORITIES = ["low", "medium", "high", "urgent"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

/** A task as stored in the `tasks` collection. */
export interface TaskDoc extends BaseDoc {
  workspaceId: ObjectId;
  /** `null` means the task is in the backlog (not assigned to a sprint). */
  sprintId: ObjectId | null;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  /** Member assignments (a task may have zero or more assignees). */
  assigneeIds: ObjectId[];
  /** The user who created the task. */
  reporterId: ObjectId;
  labels: string[];
  /** Sort key within the task's current column (ascending). */
  order: number;
  dueDate?: Date | null;
}

/** JSON-safe task DTO for Client Components (board, lists, detail views). */
export interface Task {
  id: string;
  workspaceId: string;
  sprintId: string | null;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
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
    sprintId: doc.sprintId ? doc.sprintId.toString() : null,
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

// An ObjectId is a 24-character hex string; validate ids that arrive from forms.
const objectIdString = z
  .string()
  .regex(/^[a-f0-9]{24}$/i, "Invalid id");

const optionalDate = z
  .string()
  .optional()
  .transform((v) => (v ? new Date(v) : null));

/** Fields accepted when creating a task. Server fills in reporter/order/etc. */
export const createTaskSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  description: z.string().trim().max(10_000).optional(),
  status: z.enum(TASK_STATUSES).default("todo"),
  priority: z.enum(TASK_PRIORITIES).default("medium"),
  sprintId: objectIdString.nullable().optional(),
  assigneeIds: z.array(objectIdString).default([]),
  labels: z.array(z.string().trim().min(1).max(40)).default([]),
  dueDate: optionalDate,
});
export type CreateTaskInput = z.infer<typeof createTaskSchema>;

/** All create fields become optional on update; `.partial()` keeps types honest. */
export const updateTaskSchema = createTaskSchema.partial();
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;

/** Payload for a drag-and-drop move on the board. */
export const moveTaskSchema = z.object({
  taskId: objectIdString,
  status: z.enum(TASK_STATUSES),
  /** New sort position within the destination column. */
  order: z.number(),
});
export type MoveTaskInput = z.infer<typeof moveTaskSchema>;
