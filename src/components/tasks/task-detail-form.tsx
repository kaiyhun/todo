"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteTaskAction, updateTaskAction } from "@/lib/actions/tasks";
import { Button } from "@/components/ui/button";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { AssigneePicker } from "@/components/shared/assignee-picker";
import { formatDate } from "@/lib/format";
import {
  PRIORITIES,
  PRIORITY_LABELS,
  TASK_STATUSES,
  TASK_STATUS_LABELS,
  type Priority,
  type TaskStatus,
} from "@/lib/models/enums";
import type { TaskDetail } from "@/lib/task-types";

/**
 * Edit form for a single task, shared by the full page and the intercepted modal.
 *
 * `onClose` is supplied by the modal (it calls `router.back()`); on the full page
 * it's absent and we simply refresh in place.
 */
export function TaskDetailForm({
  detail,
  onClose,
}: {
  detail: TaskDetail;
  onClose?: () => void;
}) {
  const router = useRouter();
  const { task, epics, members, reporterName } = detail;

  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? "");
  const [status, setStatus] = useState<TaskStatus>(task.status);
  const [priority, setPriority] = useState<Priority>(task.priority);
  const [epicId, setEpicId] = useState(task.epicId);
  const [assigneeIds, setAssigneeIds] = useState<string[]>(task.assigneeIds);
  const [labels, setLabels] = useState(task.labels.join(", "));
  // <input type="date"> wants YYYY-MM-DD; the DTO carries a full ISO string.
  const [dueDate, setDueDate] = useState(task.dueDate ? task.dueDate.slice(0, 10) : "");

  const [pending, startTransition] = useTransition();
  const [deleting, startDeleting] = useTransition();

  function handleSave(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed || pending) return;

    startTransition(async () => {
      const result = await updateTaskAction(task.id, {
        title: trimmed,
        description: description.trim(),
        status,
        priority,
        epicId,
        assigneeIds,
        labels: labels
          .split(",")
          .map((label) => label.trim())
          .filter(Boolean),
        // "" clears the due date; the action maps null/"" → null.
        dueDate: dueDate || null,
      });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Task saved");
      router.refresh();
      onClose?.();
    });
  }

  function handleDelete() {
    startDeleting(async () => {
      const result = await deleteTaskAction(task.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Task deleted");
      if (onClose) {
        onClose();
      } else {
        router.push("/tasks");
      }
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSave} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="task-title">Title</Label>
        <Input
          id="task-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          required
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="task-epic">Epic</Label>
          <Select value={epicId} onValueChange={setEpicId}>
            <SelectTrigger id="task-epic" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {epics.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {option.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Changing this re-parents the task — same as dragging it to another row.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="task-status">Status</Label>
          <Select
            value={status}
            onValueChange={(value) => setStatus(value as TaskStatus)}
          >
            <SelectTrigger id="task-status" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TASK_STATUSES.map((value) => (
                <SelectItem key={value} value={value}>
                  {TASK_STATUS_LABELS[value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="task-priority">Priority</Label>
          <Select
            value={priority}
            onValueChange={(value) => setPriority(value as Priority)}
          >
            <SelectTrigger id="task-priority" className="w-full">
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
          <Label htmlFor="task-due">Due date</Label>
          <Input
            id="task-due"
            type="date"
            value={dueDate}
            onChange={(event) => setDueDate(event.target.value)}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="task-assignees">Assignees</Label>
        <AssigneePicker
          id="task-assignees"
          members={members}
          value={assigneeIds}
          onChange={setAssigneeIds}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="task-labels">Labels</Label>
        <Input
          id="task-labels"
          value={labels}
          onChange={(event) => setLabels(event.target.value)}
          placeholder="frontend, bug"
        />
        <p className="text-xs text-muted-foreground">Comma separated.</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="task-description">Description</Label>
        <Textarea
          id="task-description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={4}
        />
      </div>

      {/* Read-only context */}
      <dl className="grid grid-cols-3 gap-x-4 gap-y-2 rounded-md border bg-muted/30 p-3 text-xs">
        <div className="flex items-center gap-2">
          <dt className="text-muted-foreground">Reporter</dt>
          <dd>{reporterName}</dd>
        </div>
        <div className="flex items-center gap-2">
          <dt className="text-muted-foreground">Created</dt>
          <dd>{formatDate(task.createdAt)}</dd>
        </div>
        <div className="flex items-center gap-2">
          <dt className="text-muted-foreground">Updated</dt>
          <dd>{formatDate(task.updatedAt)}</dd>
        </div>
      </dl>

      <div className="flex items-center justify-between gap-2 pt-2">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button type="button" variant="ghost" size="sm" className="gap-1.5 text-destructive">
              <Trash2 className="size-4" />
              Delete
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete “{task.title}”?</AlertDialogTitle>
              <AlertDialogDescription>
                This permanently deletes the task. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={(event) => {
                  event.preventDefault();
                  handleDelete();
                }}
                disabled={deleting}
              >
                {deleting ? "Deleting…" : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <div className="flex gap-2">
          {onClose ? (
            <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
              Cancel
            </Button>
          ) : null}
          <Button type="submit" disabled={pending || !title.trim()}>
            {pending ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </div>
    </form>
  );
}
