/**
 * Sprint model.
 *
 * A sprint is a time-boxed iteration that groups **epics** (the board's rows).
 * Epics reference a sprint by id; an epic with `sprintId === null` lives in the
 * backlog. Tasks inherit their sprint from the epic that owns them.
 */
import { z } from "zod";
import type { ObjectId } from "mongodb";
import { serializeDate, type BaseDoc } from "./common";
import { SPRINT_STATUSES, type SprintStatus } from "./enums";

// Re-exported for server-side callers; Client Components must import these from
// `models/enums` directly (this file pulls in the Mongo driver via `common`).
export { SPRINT_STATUSES, type SprintStatus };

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

// Raw `YYYY-MM-DD` (or empty) — the action converts it through the workspace
// timezone. Never coerce with `new Date()` here: `new Date("2026-07-20")` is UTC
// midnight, which is a day off once rendered in a non-UTC project zone.
const dateInput = z.string().trim().optional();

export const createSprintSchema = z.object({
  name: z.string().trim().min(1, "Sprint name is required").max(120),
  goal: z.string().trim().max(500).optional(),
  status: z.enum(SPRINT_STATUSES).default("planned"),
  startDate: dateInput,
  endDate: dateInput,
});
export type CreateSprintInput = z.infer<typeof createSprintSchema>;

// Written out by hand (not `createSprintSchema.partial()`): every field optional,
// but `goal`/dates are nullable so they can be *cleared*, and there is no
// `.default()` to silently reset an omitted field.
export const updateSprintSchema = z.object({
  name: z.string().trim().min(1, "Sprint name is required").max(120).optional(),
  goal: z.string().trim().max(500).nullable().optional(),
  status: z.enum(SPRINT_STATUSES).optional(),
  startDate: z.string().trim().nullable().optional(),
  endDate: z.string().trim().nullable().optional(),
});
export type UpdateSprintInput = z.infer<typeof updateSprintSchema>;
