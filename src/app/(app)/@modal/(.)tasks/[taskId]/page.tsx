import { notFound } from "next/navigation";
import { requireContext } from "@/lib/session";
import { getTaskDetail } from "@/lib/queries/tasks";
import { TaskModal } from "@/components/tasks/task-modal";

/**
 * Intercepting route: `(.)tasks/[taskId]` sits in the `@modal` slot at the
 * `(app)` level, so a *soft* navigation to /tasks/<id> — from the board or the
 * tasks table — renders this modal over the current page. A direct load or
 * refresh of the same URL bypasses the interception and renders the full page at
 * `app/(app)/tasks/[taskId]/page.tsx` instead.
 */
export default async function InterceptedTaskPage({
  params,
}: {
  // Next.js 16: `params` is async and must be awaited.
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

  return <TaskModal detail={detail} />;
}
