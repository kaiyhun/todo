import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { requireContext } from "@/lib/session";
import { getTaskDetail } from "@/lib/queries/tasks";
import { TaskDetailForm } from "@/components/tasks/task-detail-form";

export const metadata: Metadata = { title: "Task" };

/**
 * The full page for a task. Reached by a direct load, a refresh, or a shared
 * link; a soft navigation from inside the app is intercepted into a modal
 * instead (see `app/(app)/@modal/(.)tasks/[taskId]/page.tsx`).
 */
export default async function TaskPage({
  params,
}: {
  params: Promise<{ taskId: string }>;
}) {
  const { taskId } = await params;
  const { workspace } = await requireContext();

  const detail = await getTaskDetail(
    workspace.id,
    workspace.members.map((member) => member.userId),
    taskId,
  );
  if (!detail) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-6">
      <Link
        href="/tasks"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" />
        Back to tasks
      </Link>

      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          {detail.task.title}
        </h1>
        <p className="text-sm text-muted-foreground">
          In epic “{detail.epic.title}”
        </p>
      </header>

      <div className="rounded-lg border p-4">
        <TaskDetailForm detail={detail} />
      </div>
    </div>
  );
}
