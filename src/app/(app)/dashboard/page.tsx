import type { Metadata } from "next";
import Link from "next/link";
import { requireContext } from "@/lib/session";
import {
  tasksCollection,
  sprintsCollection,
  epicsCollection,
} from "@/lib/db/collections";
import { toObjectId } from "@/lib/models/common";
import {
  TASK_STATUSES,
  TASK_STATUS_LABELS,
  type TaskStatus,
} from "@/lib/models/enums";
import { serializeTask } from "@/lib/models/task";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Dashboard" };

/** Tailwind classes for each priority badge. */
const PRIORITY_STYLES: Record<string, string> = {
  urgent: "bg-red-500/15 text-red-600 dark:text-red-400",
  high: "bg-orange-500/15 text-orange-600 dark:text-orange-400",
  medium: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  low: "bg-muted text-muted-foreground",
};

export default async function DashboardPage() {
  const { user, workspace } = await requireContext();
  const workspaceId = toObjectId(workspace.id);
  const tasks = tasksCollection();

  // Fetch the per-column counts, the active sprint, and the most recently
  // touched tasks in parallel — three independent reads.
  const [grouped, activeSprint, recentDocs, epicCount] = await Promise.all([
    tasks
      .aggregate<{ _id: TaskStatus; count: number }>([
        { $match: { workspaceId } },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ])
      .toArray(),
    sprintsCollection().findOne({ workspaceId, status: "active" }),
    tasks.find({ workspaceId }).sort({ updatedAt: -1 }).limit(6).toArray(),
    epicsCollection().countDocuments({ workspaceId }),
  ]);

  // Normalise the aggregation into a full status→count map (zero-filled).
  const counts = Object.fromEntries(
    TASK_STATUSES.map((status) => [status, 0]),
  ) as Record<TaskStatus, number>;
  for (const row of grouped) counts[row._id] = row.count;
  const total = TASK_STATUSES.reduce((sum, status) => sum + counts[status], 0);

  const recent = recentDocs.map(serializeTask);

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          Welcome back, {user.name.split(" ")[0]}
        </h1>
        <p className="text-sm text-muted-foreground">
          Here&apos;s what&apos;s happening in {workspace.name}.
        </p>
      </header>

      {/* Per-column task counts */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {TASK_STATUSES.map((status) => (
          <Card key={status}>
            <CardHeader className="pb-2">
              <CardDescription>{TASK_STATUS_LABELS[status]}</CardDescription>
              <CardTitle className="text-3xl tabular-nums">
                {counts[status]}
              </CardTitle>
            </CardHeader>
          </Card>
        ))}
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Active sprint */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Active sprint</CardTitle>
          </CardHeader>
          <CardContent>
            {activeSprint ? (
              <div className="space-y-2">
                <p className="font-medium">{activeSprint.name}</p>
                {activeSprint.goal ? (
                  <p className="text-sm text-muted-foreground">
                    {activeSprint.goal}
                  </p>
                ) : null}
                <p className="text-xs text-muted-foreground">
                  {formatDate(
                    activeSprint.startDate?.toISOString() ?? null,
                    workspace.timezone,
                  )}{" "}
                  –{" "}
                  {formatDate(
                    activeSprint.endDate?.toISOString() ?? null,
                    workspace.timezone,
                  )}
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No active sprint. Start one from the Board.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Recent activity */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Recently updated</CardTitle>
          </CardHeader>
          <CardContent>
            {recent.length === 0 ? (
              <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                No tasks yet. Run{" "}
                <code className="rounded bg-muted px-1 py-0.5 font-mono">
                  npm run seed
                </code>{" "}
                to load demo data, or add tasks from the{" "}
                <Link href="/board" className="underline underline-offset-4">
                  Board
                </Link>
                .
              </div>
            ) : (
              <ul className="divide-y">
                {recent.map((task) => (
                  <li
                    key={task.id}
                    className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
                  >
                    <span className="min-w-0 truncate text-sm">{task.title}</span>
                    <span className="flex shrink-0 items-center gap-2">
                      <Badge
                        variant="secondary"
                        className={PRIORITY_STYLES[task.priority]}
                      >
                        {task.priority}
                      </Badge>
                      <Badge variant="outline">
                        {TASK_STATUS_LABELS[task.status]}
                      </Badge>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <p className="text-center text-xs text-muted-foreground">
        {epicCount} {epicCount === 1 ? "epic" : "epics"} · {total}{" "}
        {total === 1 ? "task" : "tasks"} in this workspace
      </p>
    </div>
  );
}
