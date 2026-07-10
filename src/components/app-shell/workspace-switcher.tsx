"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronsUpDown, Crown, LogOut } from "lucide-react";
import { toast } from "sonner";
import {
  leaveWorkspaceAction,
  switchWorkspaceAction,
} from "@/lib/actions/workspace";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
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
import { cn } from "@/lib/utils";
import type { WorkspaceRole } from "@/lib/models/workspace";

/** One entry in the switcher: a workspace the user belongs to, and their role. */
export type WorkspaceOption = {
  id: string;
  name: string;
  role: WorkspaceRole;
};

/** Square initial badge, matching the old static workspace header. */
function WorkspaceBadge({ name }: { name: string }) {
  return (
    <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary text-sm font-semibold text-primary-foreground">
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

/**
 * Sidebar workspace header. With a single workspace (and in LOCAL_MODE) it's a
 * plain label; with more than one it becomes a dropdown to switch between them
 * and to leave the current one.
 */
export function WorkspaceSwitcher({
  workspaces,
  activeId,
  localMode,
}: {
  workspaces: WorkspaceOption[];
  activeId: string;
  localMode: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [leaveOpen, setLeaveOpen] = useState(false);

  const active = workspaces.find((w) => w.id === activeId) ?? workspaces[0];
  const subtitle = `Sprintboard${localMode ? " · local" : ""}`;

  if (!active) return null;

  // Nothing to switch between — render the plain header.
  if (workspaces.length <= 1) {
    return (
      <div className="flex h-14 items-center gap-2 border-b px-4">
        <WorkspaceBadge name={active.name} />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold leading-tight">
            {active.name}
          </p>
          <p className="truncate text-xs leading-tight text-muted-foreground">
            {subtitle}
          </p>
        </div>
      </div>
    );
  }

  function switchTo(id: string) {
    if (id === activeId) return;
    startTransition(async () => {
      const result = await switchWorkspaceAction(id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      router.refresh();
    });
  }

  function leave() {
    startTransition(async () => {
      const result = await leaveWorkspaceAction();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`You left ${active.name}`);
      setLeaveOpen(false);
      router.refresh();
    });
  }

  return (
    <div className="border-b p-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="h-auto w-full justify-start gap-2 px-2 py-1.5"
            aria-label="Switch workspace"
          >
            <WorkspaceBadge name={active.name} />
            <div className="min-w-0 flex-1 text-left">
              <p className="truncate text-sm font-semibold leading-tight">
                {active.name}
              </p>
              <p className="truncate text-xs leading-tight text-muted-foreground">
                {subtitle}
              </p>
            </div>
            <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuLabel className="text-xs text-muted-foreground">
            Workspaces
          </DropdownMenuLabel>
          {workspaces.map((w) => (
            <DropdownMenuItem
              key={w.id}
              onSelect={() => switchTo(w.id)}
              disabled={pending}
              className="gap-2"
            >
              <Check
                className={cn(
                  "size-4 shrink-0",
                  w.id === activeId ? "opacity-100" : "opacity-0",
                )}
              />
              <span className="flex-1 truncate">{w.name}</span>
              {w.role === "owner" ? (
                <Crown className="size-3.5 shrink-0 text-muted-foreground" />
              ) : null}
            </DropdownMenuItem>
          ))}

          {/* The owner can't leave — ownership must be transferred first. */}
          {active.role !== "owner" ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="gap-2 text-destructive focus:text-destructive"
                onSelect={(event) => {
                  event.preventDefault();
                  setLeaveOpen(true);
                }}
              >
                <LogOut className="size-4" />
                Leave workspace
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={leaveOpen} onOpenChange={setLeaveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave {active.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              You will lose access to this workspace and be unassigned from its
              tasks and epics. An admin would need to add you back.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                leave();
              }}
              disabled={pending}
            >
              {pending ? "Leaving…" : "Leave"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
