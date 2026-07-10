"use client";

import { useState, useTransition } from "react";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteEpicAction } from "@/lib/actions/epics";
import { EditEpicDialog } from "./edit-epic-dialog";
import type { Sprint } from "@/lib/models/sprint";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { BoardMember } from "@/lib/board-types";
import type { Epic } from "@/lib/models/epic";
import type { EpicProgress } from "@/lib/models/epic-progress";
import { AssigneeAvatars, PriorityBadge, StatusBadge } from "./badges";

/**
 * The leading cell of an epic row.
 *
 * The status badge here is *derived* from the row's tasks (see
 * `rollupEpicStatus`) and is deliberately read-only — an epic never sits in a
 * status column of its own.
 */
export function EpicRowHeader({
  epic,
  progress,
  members,
  sprints,
}: {
  epic: Epic;
  progress: EpicProgress;
  members: BoardMember[];
  sprints: Sprint[];
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteEpicAction(epic.id);
      if (result.ok) {
        toast.success("Epic deleted");
      } else {
        toast.error(result.error);
      }
      setConfirmOpen(false);
    });
  }

  return (
    <div className="sticky left-0 z-10 flex flex-col gap-2 border-r bg-background p-3">
      <div className="flex items-start gap-1">
        <p className="flex-1 text-sm leading-snug font-semibold">{epic.title}</p>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-6 shrink-0"
              aria-label={`Actions for epic ${epic.title}`}
            >
              <MoreHorizontal className="size-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onSelect={(event) => {
                // Keep the menu from closing the dialog it's about to open.
                event.preventDefault();
                setEditOpen(true);
              }}
            >
              <Pencil className="size-4" />
              Edit epic
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onSelect={(event) => {
                event.preventDefault();
                setConfirmOpen(true);
              }}
            >
              <Trash2 className="size-4" />
              Delete epic
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <StatusBadge status={progress.status} />
            </span>
          </TooltipTrigger>
          <TooltipContent>Derived automatically from this epic&apos;s tasks</TooltipContent>
        </Tooltip>
        <PriorityBadge priority={epic.priority} />
      </div>

      <div className="space-y-1">
        <Progress
          value={progress.percentComplete}
          className="h-1.5"
          aria-label={
            progress.total === 0
              ? "No tasks yet"
              : `${progress.closed} of ${progress.total} tasks closed`
          }
        />
        <p className="text-[11px] text-muted-foreground">
          {progress.total === 0
            ? "No tasks yet"
            : `${progress.closed}/${progress.total} closed`}
        </p>
      </div>

      <AssigneeAvatars assigneeIds={epic.assigneeIds} members={members} />

      <EditEpicDialog
        epic={epic}
        sprints={sprints}
        members={members}
        open={editOpen}
        onOpenChange={setEditOpen}
      />

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{epic.title}”?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes the epic and all{" "}
              {progress.total === 1 ? "1 task" : `${progress.total} tasks`} inside
              it. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                handleDelete();
              }}
              disabled={pending}
            >
              {pending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
