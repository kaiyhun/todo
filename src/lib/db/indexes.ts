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

    // Board reads sort by (status, order); other views filter by sprint/assignee.
    db
      .collection(COLLECTIONS.tasks)
      .createIndex({ workspaceId: 1, status: 1, order: 1 }),
    db.collection(COLLECTIONS.tasks).createIndex({ workspaceId: 1, sprintId: 1 }),
    db.collection(COLLECTIONS.tasks).createIndex({ assigneeIds: 1 }),

    // Wiki pages are unique by slug within a workspace and nested via parentId.
    db
      .collection(COLLECTIONS.wikiPages)
      .createIndex({ workspaceId: 1, slug: 1 }, { unique: true }),
    db.collection(COLLECTIONS.wikiPages).createIndex({ workspaceId: 1, parentId: 1 }),
  ]);
}
