import Link from "next/link";
import { ListTodo } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AssigneeAvatars,
  PriorityBadge,
  StatusBadge,
} from "@/components/board/badges";
import { formatDate } from "@/lib/format";
import type { BoardMember } from "@/lib/board-types";
import type { TaskListRow } from "@/lib/task-types";

/**
 * Flat table of tasks across every epic. Each title links to `/tasks/<id>`,
 * which the intercepting route turns into a modal on a soft navigation and a
 * full page on a direct load.
 */
export function TasksTable({
  rows,
  members,
}: {
  rows: TaskListRow[];
  members: BoardMember[];
}) {
  if (rows.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-12 text-center">
        <div className="flex size-12 items-center justify-center rounded-xl border bg-muted/40">
          <ListTodo className="size-6 text-muted-foreground" />
        </div>
        <div className="space-y-1">
          <p className="font-medium">No tasks match these filters</p>
          <p className="text-sm text-muted-foreground">
            Try clearing a filter, or add a task from the{" "}
            <Link href="/board" className="underline underline-offset-4">
              Board
            </Link>
            .
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="min-w-[220px]">Title</TableHead>
            <TableHead>Epic</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Priority</TableHead>
            <TableHead>Assignees</TableHead>
            <TableHead>Due</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(({ task, epicTitle }) => (
            <TableRow key={task.id}>
              <TableCell>
                <Link
                  href={`/tasks/${task.id}`}
                  className="font-medium hover:underline"
                >
                  {task.title}
                </Link>
              </TableCell>
              <TableCell className="text-muted-foreground">{epicTitle}</TableCell>
              <TableCell>
                <StatusBadge status={task.status} />
              </TableCell>
              <TableCell>
                <PriorityBadge priority={task.priority} />
              </TableCell>
              <TableCell>
                {task.assigneeIds.length > 0 ? (
                  <AssigneeAvatars
                    assigneeIds={task.assigneeIds}
                    members={members}
                  />
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell className="text-muted-foreground whitespace-nowrap">
                {formatDate(task.dueDate)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
