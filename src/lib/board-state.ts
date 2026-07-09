/**
 * Pure state transitions for the board grid.
 *
 * Drag-and-drop is where ordering bugs hide, so the moves live here as plain
 * functions over plain data — no React, no dnd-kit. The client component simply
 * feeds them the ids dnd-kit reports and stores the result.
 *
 * Every function is immutable: it returns new rows rather than mutating.
 */
import type { Epic } from "./models/epic";
import type { Task } from "./models/task";
import type { TaskStatus } from "./models/enums";

/** A board row as held in client state (progress is derived, never stored). */
export interface BoardRowState {
  epic: Epic;
  tasksByStatus: Record<TaskStatus, Task[]>;
}

/** Where a task currently sits. */
export interface TaskLocation {
  epicId: string;
  status: TaskStatus;
  index: number;
}

/** A destination cell: the intersection of an epic row and a status column. */
export interface CellRef {
  epicId: string;
  status: TaskStatus;
}

/** Find which cell a task is in, and its position within that cell. */
export function findTaskLocation(
  rows: BoardRowState[],
  taskId: string,
): TaskLocation | null {
  for (const row of rows) {
    for (const status of Object.keys(row.tasksByStatus) as TaskStatus[]) {
      const index = row.tasksByStatus[status].findIndex((t) => t.id === taskId);
      if (index !== -1) return { epicId: row.epic.id, status, index };
    }
  }
  return null;
}

/** The tasks in a given cell (empty array when the row doesn't exist). */
export function getCellTasks(
  rows: BoardRowState[],
  cell: CellRef,
): Task[] {
  const row = rows.find((r) => r.epic.id === cell.epicId);
  return row ? row.tasksByStatus[cell.status] : [];
}

/** Whether two cell references point at the same cell. */
export function sameCell(a: CellRef, b: CellRef): boolean {
  return a.epicId === b.epicId && a.status === b.status;
}

/**
 * Move a task into `destination`, positioned just before `overTaskId` (or
 * appended when that is null).
 *
 * Implemented as remove-then-insert, which makes the index unambiguous and
 * handles all three cases uniformly: reorder within a cell, move across columns
 * (status change), and move across rows (re-parent to another epic).
 *
 * Returns the original `rows` unchanged if the task or destination is unknown.
 */
export function moveTask(
  rows: BoardRowState[],
  taskId: string,
  destination: CellRef,
  overTaskId: string | null,
): BoardRowState[] {
  const location = findTaskLocation(rows, taskId);
  if (!location) return rows;

  const sourceRow = rows.find((r) => r.epic.id === location.epicId);
  const task = sourceRow?.tasksByStatus[location.status][location.index];
  if (!task) return rows;

  if (!rows.some((r) => r.epic.id === destination.epicId)) return rows;

  // The moved task adopts its destination's identity.
  const movedTask: Task = {
    ...task,
    epicId: destination.epicId,
    status: destination.status,
  };

  // 1. Remove from the source cell.
  const withoutTask = rows.map((row) => {
    if (row.epic.id !== location.epicId) return row;
    return {
      ...row,
      tasksByStatus: {
        ...row.tasksByStatus,
        [location.status]: row.tasksByStatus[location.status].filter(
          (t) => t.id !== taskId,
        ),
      },
    };
  });

  // 2. Insert into the destination cell, before `overTaskId` when supplied.
  return withoutTask.map((row) => {
    if (row.epic.id !== destination.epicId) return row;

    const cell = row.tasksByStatus[destination.status];
    const overIndex = overTaskId
      ? cell.findIndex((t) => t.id === overTaskId)
      : -1;
    const insertAt = overIndex === -1 ? cell.length : overIndex;

    const next = [...cell];
    next.splice(insertAt, 0, movedTask);

    return {
      ...row,
      tasksByStatus: { ...row.tasksByStatus, [destination.status]: next },
    };
  });
}
