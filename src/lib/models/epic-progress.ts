/**
 * An epic's derived status and progress.
 *
 * Pure functions over task counts — no zod, no Mongo — so the board's Client
 * Components can recompute an epic's badge live as cards are dragged, using the
 * exact same rule the server uses. One source of truth for the rollup.
 */
import { TASK_STATUSES, type TaskStatus } from "./enums";

/** How many of an epic's tasks sit in each status. */
export type TaskStatusCounts = Record<TaskStatus, number>;

/** A zero-filled counts object — the safe starting point for any aggregation. */
export function emptyTaskStatusCounts(): TaskStatusCounts {
  return Object.fromEntries(
    TASK_STATUSES.map((status) => [status, 0]),
  ) as TaskStatusCounts;
}

/**
 * Derive an epic's status from its tasks. Read-only: users never set it.
 *
 * The rule, in order:
 *   • no tasks at all            → `new`   (nothing to do yet)
 *   • every task closed          → `closed`
 *   • every task resolved/closed → `resolved`
 *   • any task past `new`        → `active`
 *   • otherwise (all new)        → `new`
 *
 * Monotonic: as tasks advance, the epic can only move forward.
 */
export function rollupEpicStatus(counts: TaskStatusCounts): TaskStatus {
  const total = counts.new + counts.active + counts.resolved + counts.closed;
  if (total === 0) return "new";
  if (counts.closed === total) return "closed";
  if (counts.resolved + counts.closed === total) return "resolved";
  if (counts.active > 0 || counts.resolved > 0 || counts.closed > 0) {
    return "active";
  }
  return "new";
}

/** Everything an epic row needs to render its badge and progress bar. */
export interface EpicProgress {
  counts: TaskStatusCounts;
  total: number;
  closed: number;
  /** 0–100, rounded. Zero when the epic has no tasks. */
  percentComplete: number;
  /** The derived status badge. */
  status: TaskStatus;
}

export function computeEpicProgress(counts: TaskStatusCounts): EpicProgress {
  const total = counts.new + counts.active + counts.resolved + counts.closed;
  return {
    counts,
    total,
    closed: counts.closed,
    percentComplete: total === 0 ? 0 : Math.round((counts.closed / total) * 100),
    status: rollupEpicStatus(counts),
  };
}
