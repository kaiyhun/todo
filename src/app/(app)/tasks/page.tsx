import type { Metadata } from "next";
import { requireContext } from "@/lib/session";
import { getTasksList } from "@/lib/queries/tasks";
import {
  PRIORITIES,
  TASK_STATUSES,
  type Priority,
  type TaskStatus,
} from "@/lib/models/enums";
import type { TaskFilters as Filters } from "@/lib/task-types";
import { TaskFilters } from "@/components/tasks/task-filters";
import { TasksTable } from "@/components/tasks/tasks-table";

export const metadata: Metadata = { title: "Tasks" };

type SearchParams = Record<string, string | string[] | undefined>;

/** A repeated query param arrives as an array; take the first value. */
function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Parse + validate filters from the URL. Unknown enum values are ignored. */
function parseFilters(searchParams: SearchParams): Filters {
  const status = first(searchParams.status);
  const priority = first(searchParams.priority);

  return {
    q: first(searchParams.q),
    status: (TASK_STATUSES as readonly string[]).includes(status ?? "")
      ? (status as TaskStatus)
      : undefined,
    priority: (PRIORITIES as readonly string[]).includes(priority ?? "")
      ? (priority as Priority)
      : undefined,
    assigneeId: first(searchParams.assignee),
    epicId: first(searchParams.epic),
  };
}

export default async function TasksPage({
  searchParams,
}: {
  // Next.js 16: `searchParams` is async and must be awaited.
  searchParams: Promise<SearchParams>;
}) {
  const { workspace } = await requireContext();
  const filters = parseFilters(await searchParams);

  const { rows, total, truncated, members, epics } = await getTasksList(
    workspace.id,
    workspace.members.map((member) => member.userId),
    filters,
  );

  return (
    <div className="flex h-full flex-col gap-4 p-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Tasks</h1>
        <p className="text-sm text-muted-foreground">
          Every task across all epics in {workspace.name}.
        </p>
      </header>

      <TaskFilters members={members} epics={epics} />

      <TasksTable rows={rows} members={members} />

      <p className="text-xs text-muted-foreground">
        {truncated
          ? `Showing the ${rows.length} most recently updated of ${total} matching tasks.`
          : `${total} ${total === 1 ? "task" : "tasks"}.`}
      </p>
    </div>
  );
}
