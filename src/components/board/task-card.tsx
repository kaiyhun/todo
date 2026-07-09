"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import type { BoardMember } from "@/lib/board-types";
import type { Task } from "@/lib/models/task";
import { AssigneeAvatars, PriorityBadge } from "./badges";

/**
 * The card's appearance, with no drag wiring. Rendered both in place and inside
 * the `DragOverlay` (which must not re-run `useSortable`).
 */
export function TaskCardView({
  task,
  members,
  overlay = false,
}: {
  task: Task;
  members: BoardMember[];
  overlay?: boolean;
}) {
  return (
    <div
      className={cn(
        "space-y-2 rounded-md border bg-card p-2.5 shadow-xs",
        overlay && "cursor-grabbing shadow-lg ring-2 ring-primary/40",
      )}
    >
      <p className="text-sm leading-snug font-medium">{task.title}</p>

      <div className="flex flex-wrap items-center gap-1.5">
        <PriorityBadge priority={task.priority} />
        {task.labels.slice(0, 2).map((label) => (
          <span
            key={label}
            className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
          >
            {label}
          </span>
        ))}
        <span className="ml-auto">
          <AssigneeAvatars assigneeIds={task.assigneeIds} members={members} />
        </span>
      </div>
    </div>
  );
}

/** A draggable, sortable card inside a board cell. */
export function SortableTaskCard({
  task,
  members,
}: {
  task: Task;
  members: BoardMember[];
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: task.id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      // The whole card is the drag handle; the DragOverlay renders the copy that
      // follows the cursor, so the original fades in place.
      className={cn("cursor-grab touch-none", isDragging && "opacity-40")}
      {...attributes}
      {...listeners}
    >
      <TaskCardView task={task} members={members} />
    </div>
  );
}
