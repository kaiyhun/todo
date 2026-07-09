/**
 * Task list + detail read models. Node.js runtime only (touches MongoDB).
 *
 * The list is filtered server-side from URL query params so a filtered view is
 * shareable and survives a refresh — the same approach as the board's `?sprint=`.
 */
import "server-only";
import type { Filter } from "mongodb";
import { epicsCollection, tasksCollection, usersCollection } from "@/lib/db/collections";
import { isValidObjectId, toObjectId } from "@/lib/models/common";
import { escapeRegex } from "@/lib/text";
import { serializeEpic, type EpicDoc } from "@/lib/models/epic";
import { serializeTask, type TaskDoc } from "@/lib/models/task";
import { getWorkspaceMembers } from "./members";
import type {
  EpicOption,
  TaskDetail,
  TaskFilters,
  TaskListResult,
  TaskListRow,
} from "@/lib/task-types";

/**
 * The table shows at most this many rows. A four-person team will never hit it;
 * the cap exists so a runaway workspace can't stream thousands of rows into the
 * RSC payload. When it bites, the UI says so rather than silently truncating.
 */
const MAX_ROWS = 200;

function toEpicOption(doc: EpicDoc): EpicOption {
  return {
    id: doc._id.toString(),
    title: doc.title,
    sprintId: doc.sprintId ? doc.sprintId.toString() : null,
  };
}

/** Build the Mongo filter for the tasks table from the URL-derived filters. */
function buildFilter(
  workspaceId: ReturnType<typeof toObjectId>,
  filters: TaskFilters,
): Filter<TaskDoc> {
  const filter: Filter<TaskDoc> = { workspaceId };

  if (filters.q?.trim()) {
    filter.title = { $regex: escapeRegex(filters.q.trim()), $options: "i" };
  }
  if (filters.status) filter.status = filters.status;
  if (filters.priority) filter.priority = filters.priority;
  if (filters.assigneeId && isValidObjectId(filters.assigneeId)) {
    // Matches when the array contains this id.
    filter.assigneeIds = toObjectId(filters.assigneeId);
  }
  if (filters.epicId && isValidObjectId(filters.epicId)) {
    filter.epicId = toObjectId(filters.epicId);
  }
  return filter;
}

export async function getTasksList(
  workspaceId: string,
  memberIds: string[],
  filters: TaskFilters,
): Promise<TaskListResult> {
  const workspaceObjectId = toObjectId(workspaceId);
  const filter = buildFilter(workspaceObjectId, filters);

  const [total, taskDocs, epicDocs, members] = await Promise.all([
    tasksCollection().countDocuments(filter),
    tasksCollection()
      .find(filter)
      .sort({ updatedAt: -1 })
      .limit(MAX_ROWS)
      .toArray(),
    // Small collection: fetched whole so we can name each task's epic and
    // populate the epic filter without a $lookup.
    epicsCollection().find({ workspaceId: workspaceObjectId }).sort({ order: 1 }).toArray(),
    getWorkspaceMembers(memberIds),
  ]);

  const epicTitleById = new Map(
    epicDocs.map((epic) => [epic._id.toString(), epic.title]),
  );

  const rows: TaskListRow[] = taskDocs.map((doc) => ({
    task: serializeTask(doc),
    epicTitle: epicTitleById.get(doc.epicId.toString()) ?? "—",
  }));

  return {
    rows,
    total,
    truncated: total > rows.length,
    members,
    epics: epicDocs.map(toEpicOption),
  };
}

/** Everything the task detail view needs, or `null` when the id doesn't exist. */
export async function getTaskDetail(
  workspaceId: string,
  memberIds: string[],
  taskId: string,
): Promise<TaskDetail | null> {
  if (!isValidObjectId(taskId)) return null;

  const workspaceObjectId = toObjectId(workspaceId);
  const taskDoc = await tasksCollection().findOne({
    _id: toObjectId(taskId),
    workspaceId: workspaceObjectId,
  });
  if (!taskDoc) return null;

  const [epicDoc, epicDocs, members, reporter] = await Promise.all([
    epicsCollection().findOne({
      _id: taskDoc.epicId,
      workspaceId: workspaceObjectId,
    }),
    epicsCollection().find({ workspaceId: workspaceObjectId }).sort({ order: 1 }).toArray(),
    getWorkspaceMembers(memberIds),
    usersCollection().findOne({ _id: taskDoc.reporterId }),
  ]);

  // A task without its epic shouldn't exist (delete cascades), but don't crash.
  if (!epicDoc) return null;

  return {
    task: serializeTask(taskDoc),
    epic: serializeEpic(epicDoc),
    epics: epicDocs.map(toEpicOption),
    members,
    reporterName: reporter?.name ?? "Unknown",
  };
}
