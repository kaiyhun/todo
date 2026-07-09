/**
 * Types shared by the Tasks list / detail Server Components and their Client
 * Components. Type-only imports are erased at compile time, so this module never
 * pulls a server-only dependency into the browser bundle.
 */
import type { Priority, TaskStatus } from "./models/enums";
import type { Task } from "./models/task";
import type { Epic } from "./models/epic";
import type { BoardMember } from "./board-types";

/** A minimal epic reference, for filter dropdowns and the detail view's picker. */
export interface EpicOption {
  id: string;
  title: string;
  sprintId: string | null;
}

/** One row of the tasks table: the task plus its parent epic's title. */
export interface TaskListRow {
  task: Task;
  epicTitle: string;
}

/** Filters parsed out of the URL query string. All optional. */
export interface TaskFilters {
  q?: string;
  status?: TaskStatus;
  priority?: Priority;
  assigneeId?: string;
  epicId?: string;
}

export interface TaskListResult {
  rows: TaskListRow[];
  /** Total matches before the display limit is applied. */
  total: number;
  /** True when `total` exceeded the limit and rows were cut off. */
  truncated: boolean;
  members: BoardMember[];
  epics: EpicOption[];
}

export interface TaskDetail {
  task: Task;
  /** The epic that currently owns the task. */
  epic: Epic;
  /** All epics in the workspace, so the task can be re-parented. */
  epics: EpicOption[];
  members: BoardMember[];
  reporterName: string;
}
