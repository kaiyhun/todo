"use server";

/**
 * Server Actions for tasks (the board's cards).
 *
 * Every action resolves the caller's workspace via `requireContext()` and scopes
 * all queries by `workspaceId`.
 */
import { ObjectId } from "mongodb";
import { revalidatePath } from "next/cache";
import { requireContext } from "@/lib/session";
import { epicsCollection, tasksCollection } from "@/lib/db/collections";
import { isValidObjectId, toObjectId } from "@/lib/models/common";
import {
  createTaskSchema,
  moveTaskSchema,
  serializeTask,
  type Task,
} from "@/lib/models/task";
import type { ActionResult, ActionResultWith } from "./types";

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

  // Append: one past the highest order in the destination (epic, status) cell.
  const lastInCell = await tasksCollection()
    .find({ workspaceId: workspaceObjectId, epicId: epicObjectId, status })
    .sort({ order: -1 })
    .limit(1)
    .next();

  const now = new Date();
  const doc = {
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
    order: (lastInCell?.order ?? 0) + 1,
    dueDate,
    createdAt: now,
    updatedAt: now,
  };
  await tasksCollection().insertOne(doc);

  revalidatePath("/board");
  return { ok: true, data: serializeTask(doc) };
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

  revalidatePath("/board");
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

  revalidatePath("/board");
  return { ok: true };
}
