"use server";

/**
 * Server Actions for tasks (the board's cards).
 *
 * Every action resolves the caller's workspace via `requireContext()` and scopes
 * all queries by `workspaceId`, so a user can never read or mutate another
 * workspace's data by passing a foreign id.
 */
import { ObjectId } from "mongodb";
import { revalidatePath } from "next/cache";
import { requireContext } from "@/lib/session";
import { epicsCollection, tasksCollection } from "@/lib/db/collections";
import { isValidObjectId, toObjectId } from "@/lib/models/common";
import { parseDueDate } from "@/lib/time-server";
import {
  createTaskSchema,
  moveTaskSchema,
  serializeTask,
  updateTaskSchema,
  type Task,
  type TaskDoc,
} from "@/lib/models/task";
import type { TaskStatus } from "@/lib/models/enums";
import type { ActionResult, ActionResultWith } from "./types";

/** Every task mutation can change what the board and the task list render. */
function revalidateTaskViews(taskId?: string): void {
  revalidatePath("/board");
  revalidatePath("/tasks");
  if (taskId) revalidatePath(`/tasks/${taskId}`);
}

/** The next `order` at the end of a given (epic, status) cell. Cells are 0-based. */
async function nextOrderInCell(
  workspaceId: ObjectId,
  epicId: ObjectId,
  status: TaskStatus,
): Promise<number> {
  const last = await tasksCollection()
    .find({ workspaceId, epicId, status })
    .sort({ order: -1 })
    .limit(1)
    .next();
  return (last?.order ?? -1) + 1;
}

/** Create a task inside an epic, appended to the end of its status column. */
export async function createTaskAction(
  input: unknown,
): Promise<ActionResultWith<Task>> {
  const { user, workspace } = await requireContext();

  const parsed = createTaskSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid task" };
  }
  const { epicId, title, description, status, priority, assigneeIds, labels, dueDate } =
    parsed.data;

  const workspaceObjectId = toObjectId(workspace.id);
  const epicObjectId = toObjectId(epicId);

  // The epic must exist in this workspace — this is what stops a caller from
  // parenting a task onto someone else's epic.
  const epic = await epicsCollection().findOne({
    _id: epicObjectId,
    workspaceId: workspaceObjectId,
  });
  if (!epic) return { ok: false, error: "Epic not found" };

  // "Jul 20" means the end of the 20th *in the workspace's timezone*.
  let dueDateInstant: Date | null;
  try {
    dueDateInstant = parseDueDate(dueDate, workspace.timezone);
  } catch {
    return { ok: false, error: "Invalid due date" };
  }

  const now = new Date();
  const doc: TaskDoc = {
    _id: new ObjectId(),
    workspaceId: workspaceObjectId,
    epicId: epicObjectId,
    title,
    description,
    status,
    priority,
    assigneeIds: assigneeIds.map((id) => toObjectId(id)),
    reporterId: toObjectId(user.id),
    labels,
    order: await nextOrderInCell(workspaceObjectId, epicObjectId, status),
    dueDate: dueDateInstant,
    createdAt: now,
    updatedAt: now,
  };
  await tasksCollection().insertOne(doc);

  revalidateTaskViews();
  return { ok: true, data: serializeTask(doc) };
}

/**
 * Edit a task from the detail view.
 *
 * Only keys present in `input` are written — the `$set` document is built from
 * defined values because the Mongo driver serialises `undefined` as `null`,
 * which would blank out fields the user never touched.
 *
 * Changing `status` and/or `epicId` here is the non-drag equivalent of moving the
 * card, so the task is re-slotted at the end of its destination cell.
 */
export async function updateTaskAction(
  taskId: string,
  input: unknown,
): Promise<ActionResult> {
  const { workspace } = await requireContext();
  if (!isValidObjectId(taskId)) return { ok: false, error: "Invalid task id" };

  const parsed = updateTaskSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid task" };
  }
  const patch = parsed.data;

  const workspaceObjectId = toObjectId(workspace.id);
  const taskObjectId = toObjectId(taskId);

  const existing = await tasksCollection().findOne({
    _id: taskObjectId,
    workspaceId: workspaceObjectId,
  });
  if (!existing) return { ok: false, error: "Task not found" };

  const set: Record<string, unknown> = { updatedAt: new Date() };
  if (patch.title !== undefined) set.title = patch.title;
  if (patch.description !== undefined) set.description = patch.description;
  if (patch.priority !== undefined) set.priority = patch.priority;
  if (patch.labels !== undefined) set.labels = patch.labels;
  if (patch.assigneeIds !== undefined) {
    set.assigneeIds = patch.assigneeIds.map((id) => toObjectId(id));
  }
  // `null`/"" clears the due date; `undefined` leaves it untouched. A supplied
  // date is the end of that day in the workspace timezone — never `new Date()`.
  if (patch.dueDate !== undefined) {
    try {
      set.dueDate = parseDueDate(patch.dueDate, workspace.timezone);
    } catch {
      return { ok: false, error: "Invalid due date" };
    }
  }

  const nextEpicId = patch.epicId ? toObjectId(patch.epicId) : existing.epicId;
  const nextStatus = patch.status ?? existing.status;

  if (patch.epicId) {
    const epic = await epicsCollection().findOne({
      _id: nextEpicId,
      workspaceId: workspaceObjectId,
    });
    if (!epic) return { ok: false, error: "Epic not found" };
    set.epicId = nextEpicId;
  }
  if (patch.status !== undefined) set.status = nextStatus;

  const changedCell =
    !nextEpicId.equals(existing.epicId) || nextStatus !== existing.status;
  if (changedCell) {
    set.order = await nextOrderInCell(workspaceObjectId, nextEpicId, nextStatus);
  }

  await tasksCollection().updateOne(
    { _id: taskObjectId, workspaceId: workspaceObjectId },
    { $set: set },
  );

  revalidateTaskViews(taskId);
  return { ok: true };
}

/**
 * Persist a board drag.
 *
 * The client sends the destination cell's final, complete ordering. We write
 * `(epicId, status, order)` for every id in that list, which makes the operation
 * idempotent and self-healing: a horizontal drag (status change), a vertical
 * drag (re-parent to another epic), and a pure reorder are all the same write.
 *
 * All ids are scoped to the caller's workspace, so nothing outside it can be
 * touched.
 */
export async function moveTaskAction(input: unknown): Promise<ActionResult> {
  const { workspace } = await requireContext();

  const parsed = moveTaskSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid move" };
  }
  const { taskId, toEpicId, toStatus, orderedIds } = parsed.data;

  // The moved task must be part of the ordering it claims to land in.
  if (!orderedIds.includes(taskId)) {
    return { ok: false, error: "Moved task missing from destination ordering" };
  }

  const workspaceObjectId = toObjectId(workspace.id);
  const epicObjectId = toObjectId(toEpicId);

  const destinationEpic = await epicsCollection().findOne({
    _id: epicObjectId,
    workspaceId: workspaceObjectId,
  });
  if (!destinationEpic) return { ok: false, error: "Destination epic not found" };

  // Every id must be a task in this workspace before we write anything.
  const taskObjectIds = orderedIds.map((id) => toObjectId(id));
  const owned = await tasksCollection().countDocuments({
    _id: { $in: taskObjectIds },
    workspaceId: workspaceObjectId,
  });
  if (owned !== orderedIds.length) {
    return { ok: false, error: "Board is out of date — please refresh" };
  }

  const now = new Date();
  await tasksCollection().bulkWrite(
    orderedIds.map((id, index) => ({
      updateOne: {
        filter: { _id: toObjectId(id), workspaceId: workspaceObjectId },
        update: {
          $set: {
            epicId: epicObjectId,
            status: toStatus,
            order: index,
            updatedAt: now,
          },
        },
      },
    })),
  );

  revalidateTaskViews();
  return { ok: true };
}

/** Delete a single task. */
export async function deleteTaskAction(taskId: string): Promise<ActionResult> {
  const { workspace } = await requireContext();
  if (!isValidObjectId(taskId)) return { ok: false, error: "Invalid task id" };

  const result = await tasksCollection().deleteOne({
    _id: toObjectId(taskId),
    workspaceId: toObjectId(workspace.id),
  });
  if (result.deletedCount === 0) return { ok: false, error: "Task not found" };

  revalidateTaskViews();
  return { ok: true };
}
