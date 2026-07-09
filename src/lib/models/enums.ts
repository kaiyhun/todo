/**
 * Framework-free enums shared by the server models and Client Components.
 *
 * This module deliberately has ZERO imports. Pulling it into the browser bundle
 * therefore never drags in zod or the MongoDB driver — unlike `common.ts` (which
 * imports `ObjectId`) or the model files (which import zod).
 */

/** The board's columns, in display order. A task sits in exactly one. */
export const TASK_STATUSES = ["new", "active", "resolved", "closed"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

/** Human-readable column headings. */
export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  new: "New",
  active: "Active",
  resolved: "Resolved",
  closed: "Closed",
};

/** Priority is shared by Epics and Tasks. */
export const PRIORITIES = ["low", "medium", "high", "urgent"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const PRIORITY_LABELS: Record<Priority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};
