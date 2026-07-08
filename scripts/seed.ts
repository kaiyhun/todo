/**
 * Seed script — populates the database with a demo workspace, team, sprints,
 * tasks and wiki pages so the app is explorable immediately.
 *
 * Run with:  npm run seed
 *
 * It is idempotent: users are upserted by email, and the demo workspace's
 * sprints/tasks/wiki are wiped and rebuilt on each run. It intentionally writes
 * into the workspace with the fixed LOCAL_WORKSPACE_ID so that BOTH LOCAL_MODE
 * and the demo logins below land in the same populated workspace.
 */
import "./load-env";

import { ObjectId } from "mongodb";
import { mongoClient } from "@/lib/db/mongodb";
import { ensureIndexes } from "@/lib/db/indexes";
import {
  usersCollection,
  workspacesCollection,
  sprintsCollection,
  tasksCollection,
  wikiPagesCollection,
} from "@/lib/db/collections";
import { hashPassword } from "@/lib/auth/credentials";
import { LOCAL_WORKSPACE_ID } from "@/lib/auth/local-mode";
import type { UserDoc, UserRole } from "@/lib/models/user";
import type { TaskDoc, TaskStatus, TaskPriority } from "@/lib/models/task";

/** Shared password for every demo account. */
const DEMO_PASSWORD = "password123";

const now = new Date();
const daysFromNow = (days: number) =>
  new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

/** Upsert a demo user by email and return the stored document. */
async function upsertUser(
  name: string,
  email: string,
  role: UserRole,
  passwordHash: string,
): Promise<UserDoc> {
  const users = usersCollection();
  await users.updateOne(
    { email },
    {
      $set: { name, role, passwordHash, updatedAt: now },
      $setOnInsert: { email, createdAt: now },
    },
    { upsert: true },
  );
  return (await users.findOne({ email }))!;
}

async function seed() {
  console.log("→ Ensuring indexes…");
  await ensureIndexes();

  console.log("→ Upserting demo users…");
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  const [alice, bob, carol, dave] = await Promise.all([
    upsertUser("Alice Kim", "alice@demo.test", "admin", passwordHash),
    upsertUser("Bob Lopez", "bob@demo.test", "member", passwordHash),
    upsertUser("Carol Chen", "carol@demo.test", "member", passwordHash),
    upsertUser("Dave Park", "dave@demo.test", "member", passwordHash),
  ]);

  console.log("→ Upserting demo workspace…");
  const workspaceId = new ObjectId(LOCAL_WORKSPACE_ID);
  await workspacesCollection().updateOne(
    { _id: workspaceId },
    {
      $set: {
        name: "Demo Team",
        slug: "demo",
        members: [
          { userId: alice._id, role: "owner", joinedAt: now },
          { userId: bob._id, role: "member", joinedAt: now },
          { userId: carol._id, role: "member", joinedAt: now },
          { userId: dave._id, role: "member", joinedAt: now },
        ],
        updatedAt: now,
      },
      $setOnInsert: { createdAt: now },
    },
    { upsert: true },
  );

  console.log("→ Rebuilding sprints…");
  await sprintsCollection().deleteMany({ workspaceId });
  const activeSprintId = new ObjectId();
  const nextSprintId = new ObjectId();
  await sprintsCollection().insertMany([
    {
      _id: activeSprintId,
      workspaceId,
      name: "Sprint 12 — Onboarding polish",
      goal: "Ship the new member onboarding flow and fix the top 5 bug reports.",
      status: "active",
      startDate: daysFromNow(-4),
      endDate: daysFromNow(10),
      createdAt: now,
      updatedAt: now,
    },
    {
      _id: nextSprintId,
      workspaceId,
      name: "Sprint 13 — Reporting",
      goal: "Dashboards and CSV export.",
      status: "planned",
      startDate: daysFromNow(11),
      endDate: daysFromNow(25),
      createdAt: now,
      updatedAt: now,
    },
  ]);

  console.log("→ Rebuilding tasks…");
  await tasksCollection().deleteMany({ workspaceId });

  // Compact task specs expanded into full documents below.
  const specs: Array<{
    title: string;
    status: TaskStatus;
    priority: TaskPriority;
    assignees: ObjectId[];
    sprint: ObjectId | null;
    labels?: string[];
    description?: string;
  }> = [
    { title: "Design onboarding wizard", status: "done", priority: "high", assignees: [carol._id], sprint: activeSprintId, labels: ["design"] },
    { title: "Implement step 1: profile", status: "in_review", priority: "high", assignees: [alice._id], sprint: activeSprintId, labels: ["frontend"] },
    { title: "Implement step 2: invite team", status: "in_progress", priority: "medium", assignees: [bob._id], sprint: activeSprintId, labels: ["frontend"] },
    { title: "Fix avatar upload on Safari", status: "in_progress", priority: "urgent", assignees: [dave._id], sprint: activeSprintId, labels: ["bug"] },
    { title: "Empty-state copy review", status: "todo", priority: "low", assignees: [carol._id], sprint: activeSprintId, labels: ["content"] },
    { title: "Add welcome email", status: "todo", priority: "medium", assignees: [alice._id], sprint: activeSprintId },
    { title: "Rate-limit login endpoint", status: "todo", priority: "high", assignees: [bob._id], sprint: activeSprintId, labels: ["security"] },
    { title: "Sprint 13: dashboard spike", status: "backlog", priority: "medium", assignees: [], sprint: nextSprintId },
    { title: "Sprint 13: CSV export format", status: "backlog", priority: "low", assignees: [], sprint: nextSprintId },
    { title: "Investigate slow board query", status: "backlog", priority: "medium", assignees: [dave._id], sprint: null, labels: ["performance"] },
    { title: "Upgrade to Next.js 16", status: "done", priority: "medium", assignees: [alice._id], sprint: null },
    { title: "Write API error-handling guide", status: "backlog", priority: "low", assignees: [carol._id], sprint: null, labels: ["docs"] },
  ];

  // Assign an incrementing order within each status column.
  const orderByStatus: Record<string, number> = {};
  const taskDocs: TaskDoc[] = specs.map((spec) => {
    const order = (orderByStatus[spec.status] = (orderByStatus[spec.status] ?? 0) + 1);
    return {
      _id: new ObjectId(),
      workspaceId,
      sprintId: spec.sprint,
      title: spec.title,
      description: spec.description,
      status: spec.status,
      priority: spec.priority,
      assigneeIds: spec.assignees,
      reporterId: alice._id,
      labels: spec.labels ?? [],
      order,
      dueDate: null,
      createdAt: now,
      updatedAt: now,
    };
  });
  await tasksCollection().insertMany(taskDocs);

  console.log("→ Rebuilding wiki pages…");
  await wikiPagesCollection().deleteMany({ workspaceId });
  const handbookId = new ObjectId();
  await wikiPagesCollection().insertMany([
    {
      _id: handbookId,
      workspaceId,
      title: "Team Handbook",
      slug: "team-handbook",
      content:
        "# Team Handbook\n\nWelcome to the Demo Team! This is the home page for our documentation.\n\n- How we run sprints\n- Definition of done\n- On-call rotation",
      parentId: null,
      authorId: alice._id,
      updatedById: alice._id,
      createdAt: now,
      updatedAt: now,
    },
    {
      _id: new ObjectId(),
      workspaceId,
      title: "Engineering Onboarding",
      slug: "engineering-onboarding",
      content:
        "# Engineering Onboarding\n\n1. Clone the repo\n2. Copy `.env.example` to `.env.local`\n3. Run `npm run dev`\n\nSee the Team Handbook for process docs.",
      parentId: handbookId,
      authorId: bob._id,
      updatedById: bob._id,
      createdAt: now,
      updatedAt: now,
    },
  ]);

  console.log("\n✅ Seed complete.");
  console.log("   Workspace: Demo Team (slug: demo)");
  console.log(`   ${taskDocs.length} tasks, 2 sprints, 2 wiki pages`);
  console.log("\n   Log in with any of these (password for all):");
  console.log(`   password: ${DEMO_PASSWORD}`);
  console.log("   • alice@demo.test  (owner)");
  console.log("   • bob@demo.test    (member)");
  console.log("   • carol@demo.test  (member)");
  console.log("   • dave@demo.test   (member)");
  console.log("\n   …or set LOCAL_MODE=true to skip login entirely.\n");
}

seed()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoClient.close();
  });
