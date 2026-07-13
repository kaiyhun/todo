"use server";

/**
 * Server Actions for sprints.
 *
 * Permissions are **loose** (see `lib/permissions.ts`): any member may create a
 * sprint or change which one is active, just like epics and tasks. A workspace
 * has **at most one active sprint** — activating one demotes any other back to
 * "planned".
 */
import { ObjectId } from "mongodb";
import { revalidatePath } from "next/cache";
import { requireContext } from "@/lib/session";
import { epicsCollection, sprintsCollection } from "@/lib/db/collections";
import { isValidObjectId, toObjectId } from "@/lib/models/common";
import {
  createSprintSchema,
  updateSprintSchema,
  type SprintDoc,
} from "@/lib/models/sprint";
import { endOfDayInZone, parseDueDate, startOfDayInZone } from "@/lib/time-server";
import type { ActionResult, ActionResultWith } from "./types";

/** Set every *other* active sprint in the workspace back to "planned". */
async function demoteActiveSprints(
  workspaceId: ObjectId,
  exceptId?: ObjectId,
): Promise<void> {
  await sprintsCollection().updateMany(
    {
      workspaceId,
      status: "active",
      ...(exceptId ? { _id: { $ne: exceptId } } : {}),
    },
    { $set: { status: "planned", updatedAt: new Date() } },
  );
}

/** Create a sprint. Returns its id so the caller can switch the board to it. */
export async function createSprintAction(
  input: unknown,
): Promise<ActionResultWith<{ id: string }>> {
  const { workspace } = await requireContext();

  const parsed = createSprintSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid sprint" };
  }
  const { name, goal, status, startDate, endDate } = parsed.data;

  // Dates are the start/end of that calendar day in the workspace timezone.
  let start: Date | null;
  let end: Date | null;
  try {
    start = startDate ? startOfDayInZone(startDate, workspace.timezone) : null;
    end = parseDueDate(endDate, workspace.timezone);
  } catch {
    return { ok: false, error: "Invalid sprint dates" };
  }

  const workspaceObjectId = toObjectId(workspace.id);
  // Only one sprint is active at a time.
  if (status === "active") await demoteActiveSprints(workspaceObjectId);

  const now = new Date();
  const doc: SprintDoc = {
    _id: new ObjectId(),
    workspaceId: workspaceObjectId,
    name,
    goal: goal || undefined,
    status,
    startDate: start,
    endDate: end,
    createdAt: now,
    updatedAt: now,
  };
  await sprintsCollection().insertOne(doc);

  revalidatePath("/board");
  return { ok: true, data: { id: doc._id.toString() } };
}

/**
 * Edit a sprint. Only keys present in `input` are written (built from defined
 * values, never spread — the Mongo driver serialises `undefined` as `null`).
 * Setting the status to active demotes any other active sprint.
 */
export async function updateSprintAction(
  sprintId: string,
  input: unknown,
): Promise<ActionResult> {
  const { workspace } = await requireContext();
  if (!isValidObjectId(sprintId)) return { ok: false, error: "Invalid sprint id" };

  const parsed = updateSprintSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid sprint" };
  }
  const patch = parsed.data;

  const workspaceObjectId = toObjectId(workspace.id);
  const sprintObjectId = toObjectId(sprintId);

  const existing = await sprintsCollection().findOne({
    _id: sprintObjectId,
    workspaceId: workspaceObjectId,
  });
  if (!existing) return { ok: false, error: "Sprint not found" };

  const set: Record<string, unknown> = { updatedAt: new Date() };
  const unset: Record<string, ""> = {};

  if (patch.name !== undefined) set.name = patch.name;
  if (patch.status !== undefined) set.status = patch.status;
  if (patch.goal !== undefined) {
    if (patch.goal) set.goal = patch.goal;
    else unset.goal = "";
  }
  try {
    if (patch.startDate !== undefined) {
      set.startDate = patch.startDate
        ? startOfDayInZone(patch.startDate, workspace.timezone)
        : null;
    }
    if (patch.endDate !== undefined) {
      set.endDate = patch.endDate
        ? endOfDayInZone(patch.endDate, workspace.timezone)
        : null;
    }
  } catch {
    return { ok: false, error: "Invalid sprint dates" };
  }

  // Keep the single-active invariant when this edit activates the sprint.
  if (patch.status === "active") {
    await demoteActiveSprints(workspaceObjectId, sprintObjectId);
  }

  await sprintsCollection().updateOne(
    { _id: sprintObjectId, workspaceId: workspaceObjectId },
    Object.keys(unset).length ? { $set: set, $unset: unset } : { $set: set },
  );

  revalidatePath("/board");
  return { ok: true };
}

/**
 * Delete a sprint. Its epics fall back to the backlog (`sprintId = null`), and
 * their tasks follow — nothing is orphaned.
 */
export async function deleteSprintAction(
  sprintId: string,
): Promise<ActionResult> {
  const { workspace } = await requireContext();
  if (!isValidObjectId(sprintId)) return { ok: false, error: "Invalid sprint id" };

  const workspaceObjectId = toObjectId(workspace.id);
  const sprintObjectId = toObjectId(sprintId);

  const result = await sprintsCollection().deleteOne({
    _id: sprintObjectId,
    workspaceId: workspaceObjectId,
  });
  if (result.deletedCount === 0) return { ok: false, error: "Sprint not found" };

  await epicsCollection().updateMany(
    { workspaceId: workspaceObjectId, sprintId: sprintObjectId },
    { $set: { sprintId: null, updatedAt: new Date() } },
  );

  revalidatePath("/board");
  return { ok: true };
}

/** Make `sprintId` the workspace's active sprint, demoting any other. */
export async function setActiveSprintAction(
  sprintId: string,
): Promise<ActionResult> {
  const { workspace } = await requireContext();
  if (!isValidObjectId(sprintId)) return { ok: false, error: "Invalid sprint id" };

  const workspaceObjectId = toObjectId(workspace.id);
  const sprintObjectId = toObjectId(sprintId);

  const sprint = await sprintsCollection().findOne({
    _id: sprintObjectId,
    workspaceId: workspaceObjectId,
  });
  if (!sprint) return { ok: false, error: "Sprint not found" };

  await demoteActiveSprints(workspaceObjectId, sprintObjectId);
  await sprintsCollection().updateOne(
    { _id: sprintObjectId, workspaceId: workspaceObjectId },
    { $set: { status: "active", updatedAt: new Date() } },
  );

  revalidatePath("/board");
  return { ok: true };
}
