/**
 * Index definitions.
 *
 * `ensureIndexes()` is idempotent (Mongo's `createIndex` is a no-op when the
 * index already exists), so it is safe to run from the seed script or a one-off
 * migration. We deliberately do NOT run it on every request — index creation on
 * a hot path would be wasteful.
 */
import { getDb } from "./mongodb";
import { COLLECTIONS } from "./collections";

/**
 * Indexes left behind by the pre-Epic schema, when tasks carried `sprintId` and
 * were grouped by `(workspaceId, status)` alone. Dropping them keeps the
 * collection tidy; absent indexes are ignored.
 */
const STALE_TASK_INDEXES = [
  "workspaceId_1_sprintId_1",
  "workspaceId_1_status_1_order_1",
];

async function dropStaleTaskIndexes(): Promise<void> {
  const tasks = getDb().collection(COLLECTIONS.tasks);
  for (const name of STALE_TASK_INDEXES) {
    // `dropIndex` throws IndexNotFound (27) when it isn't there — that's fine.
    await tasks.dropIndex(name).catch(() => undefined);
  }
}

export async function ensureIndexes(): Promise<void> {
  const db = getDb();

  await Promise.all([
    // Users are looked up and de-duplicated by email.
    db.collection(COLLECTIONS.users).createIndex({ email: 1 }, { unique: true }),

    // Workspaces are addressed by slug; membership is queried by user.
    db.collection(COLLECTIONS.workspaces).createIndex({ slug: 1 }, { unique: true }),
    db.collection(COLLECTIONS.workspaces).createIndex({ "members.userId": 1 }),

    // Sprints are listed per workspace and filtered by status.
    db.collection(COLLECTIONS.sprints).createIndex({ workspaceId: 1, status: 1 }),

    // The board reads a sprint's epic rows in display order.
    db
      .collection(COLLECTIONS.epics)
      .createIndex({ workspaceId: 1, sprintId: 1, order: 1 }),

    // Board cells are addressed by (epicId, status) and sorted by order.
    db
      .collection(COLLECTIONS.tasks)
      .createIndex({ workspaceId: 1, epicId: 1, status: 1, order: 1 }),
    // Fetching / counting all tasks of an epic (rollup status, cascade delete).
    db.collection(COLLECTIONS.tasks).createIndex({ epicId: 1 }),
    // "My tasks" style queries.
    db.collection(COLLECTIONS.tasks).createIndex({ assigneeIds: 1 }),

    // Wiki pages are unique by slug within a workspace and nested via parentId.
    db
      .collection(COLLECTIONS.wikiPages)
      .createIndex({ workspaceId: 1, slug: 1 }, { unique: true }),
    db.collection(COLLECTIONS.wikiPages).createIndex({ workspaceId: 1, parentId: 1 }),
    // Old slugs keep resolving after a rename; this backs that fallback lookup.
    db.collection(COLLECTIONS.wikiPages).createIndex({ workspaceId: 1, slugAliases: 1 }),
  ]);

  await dropStaleTaskIndexes();
}
