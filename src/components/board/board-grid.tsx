"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { toast } from "sonner";
import { moveTaskAction } from "@/lib/actions/tasks";
import { parseCellId, type BoardMember, type BoardRow } from "@/lib/board-types";
import {
  findTaskLocation,
  getCellTasks,
  moveTask,
  sameCell,
  type BoardRowState,
  type CellRef,
} from "@/lib/board-state";
import {
  computeEpicProgress,
  emptyTaskStatusCounts,
} from "@/lib/models/epic-progress";
import { TASK_STATUSES, TASK_STATUS_LABELS } from "@/lib/models/enums";
import type { Task } from "@/lib/models/task";
import type { Sprint } from "@/lib/models/sprint";
import { BoardCell } from "./board-cell";
import { EpicRowHeader } from "./epic-row-header";
import { TaskCardView } from "./task-card";

/**
 * Leading epic column, then one equal column per status. The minimums are sized
 * so all five columns fit a ~1280px viewport beside the sidebar; below that the
 * board scrolls horizontally and the epic column stays pinned via `sticky`.
 */
const GRID_TEMPLATE = "minmax(200px, 220px) repeat(4, minmax(170px, 1fr))";

/** Drop the server-computed progress; the client re-derives it as cards move. */
function toRowState(rows: BoardRow[]): BoardRowState[] {
  return rows.map((row) => ({ epic: row.epic, tasksByStatus: row.tasksByStatus }));
}

/** Resolve what dnd-kit reported we're over: a cell background, or a card. */
function resolveTarget(
  rows: BoardRowState[],
  overId: string,
): { cell: CellRef; overTaskId: string | null } | null {
  const parsed = parseCellId(overId);
  if (parsed) return { cell: parsed, overTaskId: null };

  const location = findTaskLocation(rows, overId);
  if (!location) return null;
  return {
    cell: { epicId: location.epicId, status: location.status },
    overTaskId: overId,
  };
}

export function BoardGrid({
  rows: serverRows,
  members,
  sprints,
  mineOnly,
  currentUserId,
}: {
  rows: BoardRow[];
  members: BoardMember[];
  /** Passed through to each row's Edit dialog, which can move an epic's sprint. */
  sprints: Sprint[];
  /** "Assigned to me" — dims other people's cards without removing them. */
  mineOnly: boolean;
  currentUserId: string;
}) {
  const [rows, setRows] = useState<BoardRowState[]>(() => toRowState(serverRows));
  const [syncedServerRows, setSyncedServerRows] = useState(serverRows);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [, startTransition] = useTransition();

  /**
   * `rowsRef` mirrors `rows` but is written synchronously. React state updaters
   * do not run immediately, and dnd-kit needs the *current* layout inside its
   * event handlers, so all drag math reads from the ref.
   */
  const rowsRef = useRef(rows);
  /** Board layout captured at drag start, used to roll back or detect no-ops. */
  const snapshotRef = useRef<BoardRowState[] | null>(null);

  const applyRows = useCallback((next: BoardRowState[]) => {
    rowsRef.current = next;
    setRows(next);
  }, []);

  // Adopt fresh server data (sent after `revalidatePath`) during render rather
  // than in an effect. This is React's documented way to reset state when a prop
  // changes, and it avoids the cascading re-render an effect would cause.
  if (serverRows !== syncedServerRows) {
    setSyncedServerRows(serverRows);
    setRows(toRowState(serverRows));
  }

  // Keep the synchronous mirror in step with whatever state was committed.
  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

  const sensors = useSensors(
    // A small threshold so a click on a card isn't swallowed as a drag.
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      // Space picks a card up. Enter is left free so it can open the task —
      // by default dnd-kit would claim both.
      keyboardCodes: { start: ["Space"], cancel: ["Escape"], end: ["Space"] },
    }),
  );

  /** Derived epic status + progress, recomputed live as cards move. */
  const progressByEpic = useMemo(() => {
    return new Map(
      rows.map((row) => {
        const counts = emptyTaskStatusCounts();
        for (const status of TASK_STATUSES) {
          counts[status] = row.tasksByStatus[status].length;
        }
        return [row.epic.id, computeEpicProgress(counts)];
      }),
    );
  }, [rows]);

  const rollback = useCallback(() => {
    if (snapshotRef.current) applyRows(snapshotRef.current);
    snapshotRef.current = null;
  }, [applyRows]);

  function handleDragStart(event: DragStartEvent) {
    const activeId = String(event.active.id);
    const current = rowsRef.current;

    const location = findTaskLocation(current, activeId);
    if (!location) return;

    setActiveTask(getCellTasks(current, location)[location.index] ?? null);
    snapshotRef.current = current;
  }

  /** Live preview: pull the card into the hovered cell as soon as we're over it. */
  function handleDragOver(event: DragOverEvent) {
    const activeId = String(event.active.id);
    const overId = event.over ? String(event.over.id) : null;
    if (!overId || overId === activeId) return;

    const current = rowsRef.current;
    const from = findTaskLocation(current, activeId);
    const target = resolveTarget(current, overId);
    if (!from || !target) return;

    // Same-cell reordering is settled on drop, not while hovering.
    if (sameCell({ epicId: from.epicId, status: from.status }, target.cell)) return;

    applyRows(moveTask(current, activeId, target.cell, target.overTaskId));
  }

  function handleDragEnd(event: DragEndEvent) {
    const activeId = String(event.active.id);
    const overId = event.over ? String(event.over.id) : null;
    setActiveTask(null);

    if (!overId) {
      rollback();
      return;
    }

    const current = rowsRef.current;
    let next = current;
    let destination: CellRef;

    if (overId === activeId) {
      // Dropped on itself. Its position already reflects any cross-cell move
      // made during `onDragOver` — do NOT run `moveTask`, which would treat the
      // missing "over" card as an append and kick it to the end of the cell.
      const location = findTaskLocation(current, activeId);
      if (!location) {
        rollback();
        return;
      }
      destination = { epicId: location.epicId, status: location.status };
    } else {
      const target = resolveTarget(current, overId);
      if (!target) {
        rollback();
        return;
      }
      destination = target.cell;
      next = moveTask(current, activeId, destination, target.overTaskId);
      applyRows(next);
    }

    // Nothing actually moved → don't write to the database.
    const origin = snapshotRef.current;
    const before = origin ? findTaskLocation(origin, activeId) : null;
    const after = findTaskLocation(next, activeId);
    const unchanged =
      before &&
      after &&
      before.epicId === after.epicId &&
      before.status === after.status &&
      before.index === after.index;

    if (unchanged) {
      snapshotRef.current = null;
      return;
    }

    // The destination cell's final ordering is the source of truth we persist.
    const orderedIds = getCellTasks(next, destination).map((task) => task.id);

    startTransition(async () => {
      const result = await moveTaskAction({
        taskId: activeId,
        toEpicId: destination.epicId,
        toStatus: destination.status,
        orderedIds,
      });

      if (!result.ok) {
        toast.error(result.error);
        rollback();
        return;
      }
      snapshotRef.current = null;
    });
  }

  return (
    <DndContext
      // A stable id is required for SSR: without it dnd-kit derives the
      // `aria-describedby` ids from a module-level counter, which differs
      // between the server render and hydration and trips a hydration mismatch.
      id="sprint-board"
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={() => {
        setActiveTask(null);
        rollback();
      }}
    >
      <div className="overflow-x-auto rounded-lg border">
        {/* Column headers */}
        <div
          className="grid border-b bg-muted/40"
          style={{ gridTemplateColumns: GRID_TEMPLATE }}
        >
          {/* Opaque (not `bg-muted/40`): as a sticky column it must hide the status
              headers that scroll behind it, not let them show through. */}
          <div className="sticky left-0 z-20 border-r bg-background px-3 py-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Epic
          </div>
          {TASK_STATUSES.map((status) => (
            <div
              key={status}
              className="px-3 py-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase"
            >
              {TASK_STATUS_LABELS[status]}
            </div>
          ))}
        </div>

        {/* One row per epic */}
        {rows.map((row) => (
          <div
            key={row.epic.id}
            className="grid border-b last:border-b-0"
            style={{ gridTemplateColumns: GRID_TEMPLATE }}
          >
            <EpicRowHeader
              epic={row.epic}
              progress={progressByEpic.get(row.epic.id)!}
              members={members}
              sprints={sprints}
            />
            {TASK_STATUSES.map((status) => (
              <div key={status} className="p-2">
                <BoardCell
                  epicId={row.epic.id}
                  status={status}
                  tasks={row.tasksByStatus[status]}
                  members={members}
                  mineOnly={mineOnly}
                  currentUserId={currentUserId}
                />
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* The card that follows the cursor. */}
      <DragOverlay>
        {activeTask ? (
          <TaskCardView task={activeTask} members={members} overlay />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
