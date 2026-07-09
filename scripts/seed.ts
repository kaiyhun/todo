/**
 * Seed script — populates the database with a demo workspace, team, sprints,
 * epics, tasks and wiki pages so the app is explorable immediately.
 *
 * Run with:  npm run seed
 *
 * It is idempotent: users are upserted by email, and the demo workspace's
 * sprints/epics/tasks/wiki are wiped and rebuilt on each run. It intentionally
 * writes into the workspace with the fixed LOCAL_WORKSPACE_ID so that BOTH
 * LOCAL_MODE and the demo logins below land in the same populated workspace.
 *
 * The demo epics deliberately cover every rollup case: an epic with no tasks,
 * one part-done, one fully resolved, and one fully closed.
 */
import "./load-env";

import { ObjectId } from "mongodb";
import { mongoClient } from "@/lib/db/mongodb";
import { ensureIndexes } from "@/lib/db/indexes";
import {
  usersCollection,
  workspacesCollection,
  sprintsCollection,
  epicsCollection,
  tasksCollection,
  wikiPagesCollection,
} from "@/lib/db/collections";
import { hashPassword } from "@/lib/auth/credentials";
import {
  LOCAL_USER_EMAIL,
  LOCAL_USER_ID,
  LOCAL_USER_NAME,
  LOCAL_WORKSPACE_ID,
} from "@/lib/auth/local-mode";
import type { UserDoc, UserRole } from "@/lib/models/user";
import type { EpicDoc } from "@/lib/models/epic";
import type { TaskDoc } from "@/lib/models/task";
import type { Priority, TaskStatus } from "@/lib/models/enums";

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

/** A compact description of one epic row and the task cards inside it. */
interface EpicSpec {
  title: string;
  description?: string;
  priority: Priority;
  sprint: ObjectId | null;
  assignees: ObjectId[];
  labels?: string[];
  tasks: Array<{
    title: string;
    status: TaskStatus;
    priority: Priority;
    assignees: ObjectId[];
    labels?: string[];
  }>;
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

  // The LOCAL_MODE identity must be a member of the workspace it lands in,
  // otherwise the members page shows a roster the local user isn't part of.
  console.log("→ Ensuring the LOCAL_MODE user…");
  const localUserId = new ObjectId(LOCAL_USER_ID);
  await usersCollection().updateOne(
    { _id: localUserId },
    {
      $set: { name: LOCAL_USER_NAME, role: "admin", updatedAt: now },
      $setOnInsert: { email: LOCAL_USER_EMAIL, createdAt: now },
    },
    { upsert: true },
  );

  console.log("→ Upserting demo workspace…");
  const workspaceId = new ObjectId(LOCAL_WORKSPACE_ID);
  await workspacesCollection().updateOne(
    { _id: workspaceId },
    {
      $set: {
        name: "Demo Team",
        slug: "demo",
        members: [
          // Owner is the local user so LOCAL_MODE has full control out of the box.
          // Alice is an admin, which exercises the "can manage people, can't
          // transfer ownership" path when you log in as her.
          { userId: localUserId, role: "owner", joinedAt: now },
          { userId: alice._id, role: "admin", joinedAt: now },
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
      goal: "Ship the new member onboarding flow and fix the top bug reports.",
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

  console.log("→ Rebuilding epics and tasks…");
  await epicsCollection().deleteMany({ workspaceId });
  await tasksCollection().deleteMany({ workspaceId });

  const specs: EpicSpec[] = [
    {
      title: "Onboarding flow",
      description: "Everything a new member sees in their first five minutes.",
      priority: "high",
      sprint: activeSprintId,
      assignees: [alice._id],
      labels: ["frontend"],
      // Mixed → rolls up to "active", 2/5 closed.
      tasks: [
        { title: "Design the wizard", status: "closed", priority: "high", assignees: [carol._id], labels: ["design"] },
        { title: "Step 1: profile", status: "closed", priority: "high", assignees: [alice._id] },
        { title: "Step 2: invite team", status: "resolved", priority: "medium", assignees: [bob._id] },
        { title: "Step 3: first epic", status: "active", priority: "medium", assignees: [alice._id] },
        { title: "Welcome email", status: "new", priority: "low", assignees: [] },
      ],
    },
    {
      title: "Billing integration",
      description: "Stripe checkout + invoices.",
      priority: "urgent",
      sprint: activeSprintId,
      assignees: [bob._id],
      labels: ["backend"],
      // All new → rolls up to "new", 0/2 closed.
      tasks: [
        { title: "Spike: Stripe vs Paddle", status: "new", priority: "urgent", assignees: [bob._id] },
        { title: "Model the invoice schema", status: "new", priority: "high", assignees: [dave._id] },
      ],
    },
    {
      title: "Safari bug bash",
      priority: "medium",
      sprint: activeSprintId,
      assignees: [dave._id],
      labels: ["bug"],
      // All closed → rolls up to "closed", 3/3.
      tasks: [
        { title: "Fix avatar upload", status: "closed", priority: "urgent", assignees: [dave._id], labels: ["bug"] },
        { title: "Fix sticky header", status: "closed", priority: "medium", assignees: [dave._id] },
        { title: "Fix date picker", status: "closed", priority: "low", assignees: [carol._id] },
      ],
    },
    {
      title: "Accessibility audit",
      priority: "medium",
      sprint: activeSprintId,
      assignees: [carol._id],
      labels: ["a11y"],
      // All resolved → rolls up to "resolved" (done, awaiting verification).
      tasks: [
        { title: "Keyboard traps", status: "resolved", priority: "high", assignees: [carol._id] },
        { title: "Colour contrast", status: "resolved", priority: "medium", assignees: [carol._id] },
      ],
    },
    {
      title: "Design system refresh",
      description: "No tasks yet — shows the empty-epic state.",
      priority: "low",
      sprint: activeSprintId,
      assignees: [],
      tasks: [],
    },
    {
      title: "Reporting & CSV export",
      priority: "medium",
      sprint: nextSprintId,
      assignees: [alice._id],
      tasks: [
        { title: "Dashboard spike", status: "new", priority: "medium", assignees: [] },
        { title: "CSV column format", status: "new", priority: "low", assignees: [carol._id], labels: ["docs"] },
      ],
    },
    {
      title: "Performance pass",
      description: "Unscheduled — lives in the backlog.",
      priority: "low",
      sprint: null,
      assignees: [dave._id],
      labels: ["performance"],
      tasks: [
        { title: "Investigate slow board query", status: "new", priority: "medium", assignees: [dave._id] },
        { title: "Add Mongo indexes", status: "active", priority: "low", assignees: [dave._id] },
      ],
    },
  ];

  const epicDocs: EpicDoc[] = [];
  const taskDocs: TaskDoc[] = [];

  // Row order is per sprint (and per backlog); card order is per (epic, status).
  const rowOrderBySprint = new Map<string, number>();

  for (const spec of specs) {
    const sprintKey = spec.sprint?.toString() ?? "backlog";
    const rowOrder = (rowOrderBySprint.get(sprintKey) ?? 0) + 1;
    rowOrderBySprint.set(sprintKey, rowOrder);

    const epicId = new ObjectId();
    epicDocs.push({
      _id: epicId,
      workspaceId,
      sprintId: spec.sprint,
      title: spec.title,
      description: spec.description,
      priority: spec.priority,
      assigneeIds: spec.assignees,
      reporterId: alice._id,
      labels: spec.labels ?? [],
      order: rowOrder,
      dueDate: null,
      createdAt: now,
      updatedAt: now,
    });

    const cardOrderByStatus = new Map<TaskStatus, number>();
    for (const task of spec.tasks) {
      const cardOrder = (cardOrderByStatus.get(task.status) ?? 0) + 1;
      cardOrderByStatus.set(task.status, cardOrder);

      taskDocs.push({
        _id: new ObjectId(),
        workspaceId,
        epicId,
        title: task.title,
        status: task.status,
        priority: task.priority,
        assigneeIds: task.assignees,
        reporterId: alice._id,
        labels: task.labels ?? [],
        order: cardOrder,
        dueDate: null,
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  await epicsCollection().insertMany(epicDocs);
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
      slugAliases: [],
      // The page's title is rendered by the route, so the body doesn't repeat it
      // as an `# H1`.
      content: [
        "Welcome to the **Demo Team**! This is the home page for our documentation.",
        "",
        "## How we run sprints",
        "",
        "| Column | Means |",
        "| --- | --- |",
        "| New | Not started |",
        "| Active | Someone is on it |",
        "| Resolved | Done, awaiting review |",
        "| Closed | Accepted |",
        "",
        "## Definition of done",
        "",
        "- [x] Code reviewed",
        "- [x] Typecheck and lint pass",
        "- [ ] Docs updated",
        "",
        "See [Engineering Onboarding](/wiki/engineering-onboarding) to get set up.",
      ].join("\n"),
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
      slugAliases: [],
      content: [
        "1. Clone the repo",
        "2. Copy `.env.example` to `.env.local`",
        "3. Seed the database, then start the dev server:",
        "",
        "```bash",
        "npm run seed",
        "npm run dev",
        "```",
        "",
        "## Conventions",
        "",
        "Models expose a `*Doc` (Mongo shape) and a serialized DTO:",
        "",
        "```ts",
        "export function serializeTask(doc: TaskDoc): Task {",
        "  return { id: doc._id.toString(), title: doc.title, status: doc.status };",
        "}",
        "```",
        "",
        "~~Ping the old #dev channel~~ — ask in #eng instead.",
      ].join("\n"),
      parentId: handbookId,
      authorId: bob._id,
      updatedById: bob._id,
      createdAt: now,
      updatedAt: now,
    },
  ]);

  console.log("\n✅ Seed complete.");
  console.log("   Workspace: Demo Team (slug: demo)");
  console.log(
    `   ${epicDocs.length} epics, ${taskDocs.length} tasks, 2 sprints, 2 wiki pages`,
  );
  console.log("\n   Log in with any of these (password for all):");
  console.log(`   password: ${DEMO_PASSWORD}`);
  console.log("   • alice@demo.test  (admin)");
  console.log("   • bob@demo.test    (member)");
  console.log("   • carol@demo.test  (member)");
  console.log("   • dave@demo.test   (member)");
  console.log("\n   …or set LOCAL_MODE=true to skip login entirely —");
  console.log("   the local user is the workspace owner.\n");
}

seed()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoClient.close();
  });
