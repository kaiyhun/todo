"use client";

import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TaskDetailForm } from "./task-detail-form";
import type { TaskDetail } from "@/lib/task-types";

/**
 * The modal shell rendered by the intercepting route. It's always open — the
 * route's presence *is* the open state — and closing means going back, which
 * unwinds the interception and restores whatever was underneath.
 */
export function TaskModal({ detail }: { detail: TaskDetail }) {
  const router = useRouter();
  const close = () => router.back();

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{detail.task.title}</DialogTitle>
          <DialogDescription>In epic “{detail.epic.title}”</DialogDescription>
        </DialogHeader>
        <TaskDetailForm detail={detail} onClose={close} />
      </DialogContent>
    </Dialog>
  );
}
