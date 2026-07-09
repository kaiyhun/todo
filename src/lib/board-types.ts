/**
 * Types and pure helpers shared by the board's Server Component (which builds the
 * data) and its Client Components (which render and drag it).
 *
 * Type-only imports are erased at compile time, so this module stays free of any
 * server-only runtime dependency.
 */
import type { TaskStatus } from "./models/enums";
import type { EpicProgress } from "./models/epic-progress";
import type { Epic } from "./models/epic";
import type { Task } from "./models/task";
import type { Sprint } from "./models/sprint";

/** Sentinel view showing epics that belong to no sprint. */
export const BACKLOG_VIEW = "backlog";

/** The subset of a workspace member the board needs to render an avatar. */
export interface BoardMember {
  id: string;
  name: string;
  image?: string;
}

/** One epic row: the epic, its derived progress, and its tasks per column. */
export interface BoardRow {
  epic: Epic;
  progress: EpicProgress;
  tasksByStatus: Record<TaskStatus, Task[]>;
}

export interface BoardData {
  /** All sprints in the workspace, ordered for the switcher. */
  sprints: Sprint[];
  /** The resolved view: a sprint id, or `BACKLOG_VIEW`. */
  view: string;
  /** The sprint being displayed, or `null` in the backlog view. */
  selectedSprint: Sprint | null;
  rows: BoardRow[];
  /** How many epics sit in the backlog (for the switcher's label). */
  backlogEpicCount: number;
}

// ---------------------------------------------------------------------------
// Cell ids
//
// dnd-kit addresses droppables by a single string id. A board cell is the
// intersection of an epic row and a status column, so we encode both. ObjectId
// hex never contains ":", which makes the separator unambiguous.
// ---------------------------------------------------------------------------

export function toCellId(epicId: string, status: TaskStatus): string {
  return `${epicId}:${status}`;
}

export function parseCellId(
  id: string,
): { epicId: string; status: TaskStatus } | null {
  const separator = id.indexOf(":");
  if (separator === -1) return null;
  return {
    epicId: id.slice(0, separator),
    status: id.slice(separator + 1) as TaskStatus,
  };
}
