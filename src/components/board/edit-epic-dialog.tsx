"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { updateEpicAction } from "@/lib/actions/epics";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PRIORITIES, PRIORITY_LABELS, type Priority } from "@/lib/models/enums";
import { BACKLOG_VIEW } from "@/lib/board-types";
import type { Epic } from "@/lib/models/epic";
import type { Sprint } from "@/lib/models/sprint";

/**
 * Edit an epic's fields and move it between sprints (or to the backlog).
 *
 * The dialog is controlled by the row's dropdown menu. Moving an epic out of the
 * sprint currently on screen makes its row disappear after revalidation — which
 * is the point: that's how you pull work into or out of a sprint.
 */
export function EditEpicDialog({
  epic,
  sprints,
  open,
  onOpenChange,
}: {
  epic: Epic;
  sprints: Sprint[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [title, setTitle] = useState(epic.title);
  const [description, setDescription] = useState(epic.description ?? "");
  const [priority, setPriority] = useState<Priority>(epic.priority);
  // `BACKLOG_VIEW` doubles as the "no sprint" option value (Radix forbids "").
  const [sprintId, setSprintId] = useState(epic.sprintId ?? BACKLOG_VIEW);
  const [pending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed || pending) return;

    startTransition(async () => {
      const result = await updateEpicAction(epic.id, {
        title: trimmed,
        description: description.trim(),
        priority,
        sprintId: sprintId === BACKLOG_VIEW ? null : sprintId,
      });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Epic updated");
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Edit epic</DialogTitle>
            <DialogDescription>
              An epic&apos;s status is derived from its tasks, so it can&apos;t be
              set here.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-epic-title">Title</Label>
              <Input
                id="edit-epic-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-epic-description">Description</Label>
              <Textarea
                id="edit-epic-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={3}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="edit-epic-priority">Priority</Label>
                <Select
                  value={priority}
                  onValueChange={(value) => setPriority(value as Priority)}
                >
                  <SelectTrigger id="edit-epic-priority" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map((value) => (
                      <SelectItem key={value} value={value}>
                        {PRIORITY_LABELS[value]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-epic-sprint">Sprint</Label>
                <Select value={sprintId} onValueChange={setSprintId}>
                  <SelectTrigger id="edit-epic-sprint" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {sprints.map((sprint) => (
                      <SelectItem key={sprint.id} value={sprint.id}>
                        {sprint.name}
                      </SelectItem>
                    ))}
                    <SelectItem value={BACKLOG_VIEW}>Backlog (no sprint)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={pending || !title.trim()}>
              {pending ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
