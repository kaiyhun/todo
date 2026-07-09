"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { cn } from "@/lib/utils";
import { toCellId, type BoardMember } from "@/lib/board-types";
import type { Task } from "@/lib/models/task";
import type { TaskStatus } from "@/lib/models/enums";
import { SortableTaskCard } from "./task-card";
import { QuickAddTask } from "./quick-add-task";

/**
 * One cell of the board grid: the intersection of an epic row and a status
 * column.
 *
 * The cell is itself a droppable (not just its cards) — that is what makes an
 * *empty* cell a valid drop target, and it is why `useDroppable` is used here in
 * addition to the `SortableContext` around the cards.
 */
export function BoardCell({
  epicId,
  status,
  tasks,
  members,
  mineOnly,
  currentUserId,
}: {
  epicId: string;
  status: TaskStatus;
  tasks: Task[];
  members: BoardMember[];
  /** When on, cards not assigned to `currentUserId` are dimmed (not removed). */
  mineOnly: boolean;
  currentUserId: string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: toCellId(epicId, status) });

  return (
    <div
      ref={setNodeRef}
      data-cell={toCellId(epicId, status)}
      className={cn(
        "flex min-h-28 flex-col gap-2 rounded-md border border-dashed border-transparent bg-muted/30 p-2 transition-colors",
        isOver && "border-primary/50 bg-accent",
      )}
    >
      <SortableContext
        items={tasks.map((task) => task.id)}
        strategy={verticalListSortingStrategy}
      >
        {tasks.map((task) => (
          <SortableTaskCard
            key={task.id}
            task={task}
            members={members}
            dimmed={mineOnly && !task.assigneeIds.includes(currentUserId)}
          />
        ))}
      </SortableContext>

      {/* Tasks are only ever created in New; from there they're dragged onward. */}
      {status === "new" ? <QuickAddTask epicId={epicId} /> : null}
    </div>
  );
}
