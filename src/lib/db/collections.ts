/**
 * Typed accessors for every MongoDB collection.
 *
 * Centralising collection names and their document types here means the rest of
 * the app never passes a raw string collection name, and every query/insert is
 * checked against the correct `*Doc` interface.
 */
import type { Collection } from "mongodb";
import { getDb } from "./mongodb";
import type { UserDoc } from "@/lib/models/user";
import type { WorkspaceDoc } from "@/lib/models/workspace";
import type { SprintDoc } from "@/lib/models/sprint";
import type { TaskDoc } from "@/lib/models/task";
import type { WikiPageDoc } from "@/lib/models/wiki";

/** Canonical collection names — the single source of truth. */
export const COLLECTIONS = {
  users: "users",
  workspaces: "workspaces",
  sprints: "sprints",
  tasks: "tasks",
  wikiPages: "wikiPages",
} as const;

export function usersCollection(): Collection<UserDoc> {
  return getDb().collection<UserDoc>(COLLECTIONS.users);
}

export function workspacesCollection(): Collection<WorkspaceDoc> {
  return getDb().collection<WorkspaceDoc>(COLLECTIONS.workspaces);
}

export function sprintsCollection(): Collection<SprintDoc> {
  return getDb().collection<SprintDoc>(COLLECTIONS.sprints);
}

export function tasksCollection(): Collection<TaskDoc> {
  return getDb().collection<TaskDoc>(COLLECTIONS.tasks);
}

export function wikiPagesCollection(): Collection<WikiPageDoc> {
  return getDb().collection<WikiPageDoc>(COLLECTIONS.wikiPages);
}
