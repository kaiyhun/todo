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
import { epicsCollection, tasksCollection } from "@/lib/db/collections";
import { isValidObjectId, toObjectId } from "@/lib/models/common";
import { createEpicSchema } from "@/lib/models/epic";
import type { ActionResult, ActionResultWith } from "./types";

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

  // Append: one past the highest existing row order in this sprint/backlog.
  const lastRow = await epicsCollection()
    .find({ workspaceId: workspaceObjectId, sprintId: sprintObjectId })
    .sort({ order: -1 })
    .limit(1)
    .next();

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
    order: (lastRow?.order ?? 0) + 1,
    dueDate,
    createdAt: now,
    updatedAt: now,
  });

  revalidatePath("/board");
  return { ok: true, data: { id: _id.toString() } };
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

  revalidatePath("/board");
  return { ok: true };
}
