"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Pencil, Play, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  deleteSprintAction,
  setActiveSprintAction,
} from "@/lib/actions/sprints";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
import { EditSprintDialog } from "./edit-sprint-dialog";
import type { Sprint } from "@/lib/models/sprint";

/**
 * Actions for the selected sprint: set active, edit, delete. Deleting sends the
 * sprint's epics to the backlog (see `deleteSprintAction`).
 */
export function SprintActions({
  sprint,
  epicCount,
}: {
  sprint: Sprint;
  epicCount: number;
}) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function setActive() {
    startTransition(async () => {
      const result = await setActiveSprintAction(sprint.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`${sprint.name} is now active`);
      router.refresh();
    });
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteSprintAction(sprint.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Sprint deleted");
      setConfirmOpen(false);
      // The current ?sprint=<id> no longer exists — fall back to the default view.
      router.push("/board");
      router.refresh();
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" aria-label="Sprint actions">
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {sprint.status !== "active" ? (
            <DropdownMenuItem onSelect={setActive} disabled={pending}>
              <Play className="size-4" />
              Set as active
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem
            onSelect={(event) => {
              event.preventDefault();
              setEditOpen(true);
            }}
          >
            <Pencil className="size-4" />
            Edit sprint
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onSelect={(event) => {
              event.preventDefault();
              setConfirmOpen(true);
            }}
          >
            <Trash2 className="size-4" />
            Delete sprint
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <EditSprintDialog
        sprint={sprint}
        open={editOpen}
        onOpenChange={setEditOpen}
      />

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {sprint.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              {epicCount > 0
                ? `Its ${epicCount} ${epicCount === 1 ? "epic" : "epics"} (and their tasks) move to the Backlog.`
                : "It has no epics."}{" "}
              This can&apos;t be undone.
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
              {pending ? "Deleting…" : "Delete sprint"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
