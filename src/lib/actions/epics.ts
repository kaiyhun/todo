"use server";

/**
 * Server Actions for epics (the board's rows).
 *
 * Every action resolves the caller's workspace via `requireContext()` and scopes
 * all queries by `workspaceId`, so a user can never read or mutate another
 * workspace's data by passing a foreign id.
 */
import { ObjectId } from "mongodb";
import { revalidatePath } from "next/cache";
import { requireContext } from "@/lib/session";
import {
  epicsCollection,
  sprintsCollection,
  tasksCollection,
} from "@/lib/db/collections";
import { isValidObjectId, toObjectId } from "@/lib/models/common";
import { createEpicSchema, updateEpicSchema } from "@/lib/models/epic";
import type { ActionResult, ActionResultWith } from "./types";

function revalidateEpicViews(): void {
  revalidatePath("/board");
  revalidatePath("/tasks");
}

/** The next row `order` at the end of a sprint (or of the backlog). Rows are 0-based. */
async function nextRowOrder(
  workspaceId: ObjectId,
  sprintId: ObjectId | null,
): Promise<number> {
  const last = await epicsCollection()
    .find({ workspaceId, sprintId })
    .sort({ order: -1 })
    .limit(1)
    .next();
  return (last?.order ?? -1) + 1;
}

/** Create an epic row, appended to the end of the target sprint (or backlog). */
export async function createEpicAction(
  input: unknown,
): Promise<ActionResultWith<{ id: string }>> {
  const { user, workspace } = await requireContext();

  const parsed = createEpicSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid epic" };
  }
  const { title, description, priority, sprintId, assigneeIds, labels, dueDate } =
    parsed.data;

  const workspaceObjectId = toObjectId(workspace.id);
  const sprintObjectId = sprintId ? toObjectId(sprintId) : null;

  const now = new Date();
  const _id = new ObjectId();
  await epicsCollection().insertOne({
    _id,
    workspaceId: workspaceObjectId,
    sprintId: sprintObjectId,
    title,
    description,
    priority,
    assigneeIds: assigneeIds.map((id) => toObjectId(id)),
    reporterId: toObjectId(user.id),
    labels,
    order: await nextRowOrder(workspaceObjectId, sprintObjectId),
    dueDate,
    createdAt: now,
    updatedAt: now,
  });

  revalidateEpicViews();
  return { ok: true, data: { id: _id.toString() } };
}

/**
 * Edit an epic, optionally moving it to another sprint (or to the backlog when
 * `sprintId` is `null`). Moving re-slots the row at the end of its destination.
 *
 * As with tasks, `$set` is built only from defined keys — the Mongo driver turns
 * `undefined` into `null`, which would blank fields the user never touched.
 */
export async function updateEpicAction(
  epicId: string,
  input: unknown,
): Promise<ActionResult> {
  const { workspace } = await requireContext();
  if (!isValidObjectId(epicId)) return { ok: false, error: "Invalid epic id" };

  const parsed = updateEpicSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid epic" };
  }
  const patch = parsed.data;

  const workspaceObjectId = toObjectId(workspace.id);
  const epicObjectId = toObjectId(epicId);

  const existing = await epicsCollection().findOne({
    _id: epicObjectId,
    workspaceId: workspaceObjectId,
  });
  if (!existing) return { ok: false, error: "Epic not found" };

  const set: Record<string, unknown> = { updatedAt: new Date() };
  if (patch.title !== undefined) set.title = patch.title;
  if (patch.description !== undefined) set.description = patch.description;
  if (patch.priority !== undefined) set.priority = patch.priority;
  if (patch.labels !== undefined) set.labels = patch.labels;
  if (patch.assigneeIds !== undefined) {
    set.assigneeIds = patch.assigneeIds.map((id) => toObjectId(id));
  }
  if (patch.dueDate !== undefined) {
    set.dueDate = patch.dueDate ? new Date(patch.dueDate) : null;
  }

  // Three-valued: undefined = leave alone, null = backlog, id = that sprint.
  if (patch.sprintId !== undefined) {
    const nextSprintId = patch.sprintId ? toObjectId(patch.sprintId) : null;

    if (nextSprintId) {
      const sprint = await sprintsCollection().findOne({
        _id: nextSprintId,
        workspaceId: workspaceObjectId,
      });
      if (!sprint) return { ok: false, error: "Sprint not found" };
    }

    const moved =
      String(existing.sprintId ?? "") !== String(nextSprintId ?? "");
    set.sprintId = nextSprintId;
    if (moved) {
      set.order = await nextRowOrder(workspaceObjectId, nextSprintId);
    }
  }

  await epicsCollection().updateOne(
    { _id: epicObjectId, workspaceId: workspaceObjectId },
    { $set: set },
  );

  revalidateEpicViews();
  return { ok: true };
}

/** Delete an epic and cascade-delete every task it owns. */
export async function deleteEpicAction(epicId: string): Promise<ActionResult> {
  const { workspace } = await requireContext();
  if (!isValidObjectId(epicId)) return { ok: false, error: "Invalid epic id" };

  const workspaceObjectId = toObjectId(workspace.id);
  const epicObjectId = toObjectId(epicId);

  const result = await epicsCollection().deleteOne({
    _id: epicObjectId,
    workspaceId: workspaceObjectId,
  });
  if (result.deletedCount === 0) {
    return { ok: false, error: "Epic not found" };
  }

  // Tasks cannot exist without their epic.
  await tasksCollection().deleteMany({
    epicId: epicObjectId,
    workspaceId: workspaceObjectId,
  });

  revalidateEpicViews();
  return { ok: true };
}
