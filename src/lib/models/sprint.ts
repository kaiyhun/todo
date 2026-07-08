/**
 * Sprint model.
 *
 * A sprint is a time-boxed iteration that groups tasks. Tasks reference a sprint
 * by id; a task with `sprintId === null` lives in the backlog.
 */
import { z } from "zod";
import type { ObjectId } from "mongodb";
import { serializeDate, type BaseDoc } from "./common";

export const SPRINT_STATUSES = ["planned", "active", "completed"] as const;
export type SprintStatus = (typeof SPRINT_STATUSES)[number];

/** A sprint as stored in the `sprints` collection. */
export interface SprintDoc extends BaseDoc {
  workspaceId: ObjectId;
  name: string;
  goal?: string;
  status: SprintStatus;
  startDate?: Date | null;
  endDate?: Date | null;
}

/** JSON-safe sprint DTO. */
export interface Sprint {
  id: string;
  workspaceId: string;
  name: string;
  goal?: string;
  status: SprintStatus;
  startDate: string | null;
  endDate: string | null;
}

export function serializeSprint(doc: SprintDoc): Sprint {
  return {
    id: doc._id.toString(),
    workspaceId: doc.workspaceId.toString(),
    name: doc.name,
    goal: doc.goal,
    status: doc.status,
    startDate: serializeDate(doc.startDate),
    endDate: serializeDate(doc.endDate),
  };
}

/** Accept a `datetime-local`/ISO string or nothing, and coerce to a Date. */
const optionalDate = z
  .string()
  .optional()
  .transform((v) => (v ? new Date(v) : null));

export const createSprintSchema = z.object({
  name: z.string().trim().min(1, "Sprint name is required").max(120),
  goal: z.string().trim().max(500).optional(),
  status: z.enum(SPRINT_STATUSES).default("planned"),
  startDate: optionalDate,
  endDate: optionalDate,
});
export type CreateSprintInput = z.infer<typeof createSprintSchema>;
