/**
 * Board read model.
 *
 * Assembles everything the sprint board renders in as few round-trips as
 * possible: the sprint switcher's options, the epic rows for the selected
 * sprint, and each row's tasks bucketed into the four status cells.
 *
 * Node.js runtime only (touches MongoDB). The shapes it returns are declared in
 * `@/lib/board-types` so Client Components can consume them without importing
 * anything server-only.
 */
import "server-only";
import {
  epicsCollection,
  sprintsCollection,
  tasksCollection,
} from "@/lib/db/collections";
import { isValidObjectId, toObjectId } from "@/lib/models/common";
import { TASK_STATUSES, type TaskStatus } from "@/lib/models/enums";
import {
  computeEpicProgress,
  emptyTaskStatusCounts,
} from "@/lib/models/epic-progress";
import { serializeSprint, type Sprint, type SprintDoc } from "@/lib/models/sprint";
import { serializeEpic } from "@/lib/models/epic";
import { serializeTask, type Task } from "@/lib/models/task";
import { BACKLOG_VIEW, type BoardData, type BoardRow } from "@/lib/board-types";

/** Active sprints first, then planned, then completed; earliest start first. */
const STATUS_RANK: Record<SprintDoc["status"], number> = {
  active: 0,
  planned: 1,
  completed: 2,
};

function sortSprints(docs: SprintDoc[]): SprintDoc[] {
  return [...docs].sort((a, b) => {
    const rank = STATUS_RANK[a.status] - STATUS_RANK[b.status];
    if (rank !== 0) return rank;
    return (a.startDate?.getTime() ?? 0) - (b.startDate?.getTime() ?? 0);
  });
}

/**
 * Resolve which view to show: an explicit, valid `?sprint=` param wins, else the
 * active sprint, else the first sprint, else the backlog.
 */
function resolveView(sprints: Sprint[], requested?: string): string {
  if (requested === BACKLOG_VIEW) return BACKLOG_VIEW;
  if (
    requested &&
    isValidObjectId(requested) &&
    sprints.some((sprint) => sprint.id === requested)
  ) {
    return requested;
  }
  return (
    sprints.find((sprint) => sprint.status === "active")?.id ??
    sprints[0]?.id ??
    BACKLOG_VIEW
  );
}

export async function getBoardData(
  workspaceId: string,
  requestedView?: string,
): Promise<BoardData> {
  const workspaceObjectId = toObjectId(workspaceId);

  const [sprintDocs, backlogEpicCount] = await Promise.all([
    sprintsCollection().find({ workspaceId: workspaceObjectId }).toArray(),
    epicsCollection().countDocuments({
      workspaceId: workspaceObjectId,
      sprintId: null,
    }),
  ]);

  const sprints = sortSprints(sprintDocs).map(serializeSprint);
  const view = resolveView(sprints, requestedView);
  const selectedSprint = sprints.find((sprint) => sprint.id === view) ?? null;

  // Epic rows for the selected view, in row order.
  const epicDocs = await epicsCollection()
    .find({
      workspaceId: workspaceObjectId,
      sprintId: view === BACKLOG_VIEW ? null : toObjectId(view),
    })
    .sort({ order: 1 })
    .toArray();

  // All tasks belonging to those rows, already sorted by their in-cell order.
  const epicIds = epicDocs.map((epic) => epic._id);
  const taskDocs = epicIds.length
    ? await tasksCollection()
        .find({ workspaceId: workspaceObjectId, epicId: { $in: epicIds } })
        .sort({ order: 1 })
        .toArray()
    : [];

  // Bucket tasks into their (epicId, status) cell. `taskDocs` is already sorted
  // by `order`, so each bucket comes out in display order.
  const emptyBuckets = () =>
    Object.fromEntries(TASK_STATUSES.map((s) => [s, [] as Task[]])) as Record<
      TaskStatus,
      Task[]
    >;

  const bucketsByEpic = new Map<string, Record<TaskStatus, Task[]>>(
    epicDocs.map((epic) => [epic._id.toString(), emptyBuckets()]),
  );
  for (const taskDoc of taskDocs) {
    // Defensive: a task whose epic isn't in this view is simply skipped.
    bucketsByEpic
      .get(taskDoc.epicId.toString())
      ?.[taskDoc.status].push(serializeTask(taskDoc));
  }

  // Each row derives its epic's rolled-up status + progress from its buckets.
  const rows: BoardRow[] = epicDocs.map((epicDoc) => {
    const tasksByStatus = bucketsByEpic.get(epicDoc._id.toString())!;
    const counts = emptyTaskStatusCounts();
    for (const status of TASK_STATUSES) {
      counts[status] = tasksByStatus[status].length;
    }
    return {
      epic: serializeEpic(epicDoc),
      progress: computeEpicProgress(counts),
      tasksByStatus,
    };
  });

  return { sprints, view, selectedSprint, rows, backlogEpicCount };
}
