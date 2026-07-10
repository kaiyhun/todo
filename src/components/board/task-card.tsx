"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import type { BoardMember } from "@/lib/board-types";
import type { Task } from "@/lib/models/task";
import { AssigneeAvatars, PriorityBadge } from "./badges";

/** Pointer travel (px) below which a press counts as a click, not a drag. */
const CLICK_SLOP = 5;

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

/**
 * A draggable, sortable card that also opens the task detail when clicked.
 *
 * Drag and click share the same element, so we distinguish them by pointer
 * travel: a press that moves less than `CLICK_SLOP` never trips dnd-kit's
 * activation constraint and is therefore a click. Our pointer/key handlers are
 * *composed* with dnd-kit's rather than replacing them — spreading `listeners`
 * and then declaring `onPointerDown` would otherwise silently override it.
 *
 * Keyboard: Space picks the card up (see the board's `KeyboardSensor` codes);
 * Enter opens it.
 */
export function SortableTaskCard({
  task,
  members,
  dimmed = false,
}: {
  task: Task;
  members: BoardMember[];
  /** Visually de-emphasised by the "Assigned to me" filter (still draggable). */
  dimmed?: boolean;
}) {
  const router = useRouter();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: task.id });

  const pointerStart = useRef<{ x: number; y: number } | null>(null);

  const openTask = () => router.push(`/tasks/${task.id}`);

  function handlePointerDown(event: React.PointerEvent) {
    pointerStart.current = { x: event.clientX, y: event.clientY };
    (listeners?.onPointerDown as ((e: React.PointerEvent) => void) | undefined)?.(
      event,
    );
  }

  function handlePointerUp(event: React.PointerEvent) {
    const start = pointerStart.current;
    pointerStart.current = null;
    if (!start) return;

    const travelled = Math.hypot(event.clientX - start.x, event.clientY - start.y);
    if (travelled < CLICK_SLOP) openTask();
  }

  function handleKeyDown(event: React.KeyboardEvent) {
    if (event.key === "Enter") {
      event.preventDefault();
      openTask();
      return;
    }
    (listeners?.onKeyDown as ((e: React.KeyboardEvent) => void) | undefined)?.(
      event,
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "cursor-grab touch-none transition-opacity",
        dimmed && "opacity-30 hover:opacity-60",
        isDragging && "opacity-40",
      )}
      {...attributes}
      {...listeners}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onKeyDown={handleKeyDown}
      // No custom `aria-label`: the card's accessible name is derived from its
      // visible content (title, priority, assignees), which is what keeps it
      // compliant with WCAG "Label in Name". dnd-kit announces the move
      // instructions; `aria-keyshortcuts` advertises that Enter opens the task.
      aria-keyshortcuts="Enter"
    >
      <TaskCardView task={task} members={members} />
    </div>
  );
}
