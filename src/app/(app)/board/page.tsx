import type { Metadata } from "next";
import { Columns3 } from "lucide-react";
import { requireContext } from "@/lib/session";
import { getBoardData } from "@/lib/queries/board";
import { getWorkspaceMembers } from "@/lib/queries/members";
import { BACKLOG_VIEW } from "@/lib/board-types";
import { formatDate } from "@/lib/format";
import { BoardGrid } from "@/components/board/board-grid";
import { SprintSwitcher } from "@/components/board/sprint-switcher";
import { CreateEpicDialog } from "@/components/board/create-epic-dialog";
import { MineFilterToggle } from "@/components/board/mine-filter-toggle";

export const metadata: Metadata = { title: "Board" };

export default async function BoardPage({
  searchParams,
}: {
  // Next.js 16: `searchParams` is async and must be awaited.
  searchParams: Promise<{ sprint?: string; mine?: string }>;
}) {
  const { user, workspace } = await requireContext();
  const { sprint: requestedView, mine } = await searchParams;
  const mineOnly = mine === "1";

  const [board, members] = await Promise.all([
    getBoardData(workspace.id, requestedView),
    getWorkspaceMembers(workspace.members.map((member) => member.userId)),
  ]);

  const isBacklog = board.view === BACKLOG_VIEW;
  // A new epic lands wherever we're currently looking.
  const sprintIdForNewEpic = isBacklog ? null : board.view;

  return (
    <div className="flex h-full flex-col gap-4 p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            {isBacklog ? "Backlog" : (board.selectedSprint?.name ?? "Board")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isBacklog
              ? "Epics that aren't scheduled into a sprint yet."
              : board.selectedSprint
                ? (board.selectedSprint.goal ??
                  `${formatDate(board.selectedSprint.startDate)} – ${formatDate(board.selectedSprint.endDate)}`)
                : "No sprints yet."}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <MineFilterToggle active={mineOnly} />
          <SprintSwitcher
            sprints={board.sprints}
            view={board.view}
            backlogEpicCount={board.backlogEpicCount}
          />
          <CreateEpicDialog sprintId={sprintIdForNewEpic} />
        </div>
      </header>

      {board.rows.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-lg border border-dashed p-12 text-center">
          <div className="flex size-12 items-center justify-center rounded-xl border bg-muted/40">
            <Columns3 className="size-6 text-muted-foreground" />
          </div>
          <div className="space-y-1">
            <p className="font-medium">No epics here yet</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              An epic is a row on the board. Create one, then break it into tasks
              and drag them across the columns.
            </p>
          </div>
          <CreateEpicDialog sprintId={sprintIdForNewEpic} />
        </div>
      ) : (
        <BoardGrid
          rows={board.rows}
          members={members}
          sprints={board.sprints}
          mineOnly={mineOnly}
          currentUserId={user.id}
        />
      )}
    </div>
  );
}
