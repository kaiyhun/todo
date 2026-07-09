/**
 * Bootstraps the singleton local user + workspace used when LOCAL_MODE is on.
 * Both helpers are idempotent so they can be called on any request without
 * creating duplicates. Node.js runtime only (touches MongoDB).
 */
import { ObjectId } from "mongodb";
import { usersCollection, workspacesCollection } from "@/lib/db/collections";
import { DEFAULT_TIMEZONE } from "@/lib/timezone";
import type { UserDoc } from "@/lib/models/user";
import type { WorkspaceDoc } from "@/lib/models/workspace";
import {
  LOCAL_USER_ID,
  LOCAL_USER_EMAIL,
  LOCAL_USER_NAME,
  LOCAL_WORKSPACE_ID,
} from "./local-mode";

/** Ensure the local user exists and return it. */
export async function ensureLocalUser(): Promise<UserDoc> {
  const users = usersCollection();
  const _id = new ObjectId(LOCAL_USER_ID);

  const existing = await users.findOne({ _id });
  if (existing) return existing;

  const now = new Date();
  const doc: UserDoc = {
    _id,
    email: LOCAL_USER_EMAIL,
    name: LOCAL_USER_NAME,
    role: "admin",
    createdAt: now,
    updatedAt: now,
  };
  // Tolerate a concurrent insert (unique email index) — re-read afterwards.
  await users.insertOne(doc).catch(() => undefined);
  return (await users.findOne({ _id }))!;
}

/** Ensure the local workspace exists (owned by the local user) and return it. */
export async function ensureLocalWorkspace(): Promise<WorkspaceDoc> {
  const workspaces = workspacesCollection();
  const _id = new ObjectId(LOCAL_WORKSPACE_ID);

  const existing = await workspaces.findOne({ _id });
  if (existing) return existing;

  const now = new Date();
  const doc: WorkspaceDoc = {
    _id,
    name: "My Workspace",
    slug: "local",
    timezone: DEFAULT_TIMEZONE,
    members: [
      { userId: new ObjectId(LOCAL_USER_ID), role: "owner", joinedAt: now },
    ],
    createdAt: now,
    updatedAt: now,
  };
  await workspaces.insertOne(doc).catch(() => undefined);
  return (await workspaces.findOne({ _id }))!;
}
