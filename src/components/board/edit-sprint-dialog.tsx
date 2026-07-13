"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { updateSprintAction } from "@/lib/actions/sprints";
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
import { useTimezone } from "@/components/providers/timezone-provider";
import { toDateInputValue } from "@/lib/format";
import {
  SPRINT_STATUSES,
  SPRINT_STATUS_LABELS,
  type SprintStatus,
} from "@/lib/models/enums";
import type { Sprint } from "@/lib/models/sprint";

/**
 * Edit a sprint's fields. Controlled by the sprint's actions menu. The stored
 * dates are UTC instants, so the date inputs show the calendar day in the
 * workspace timezone (via `toDateInputValue`).
 */
export function EditSprintDialog({
  sprint,
  open,
  onOpenChange,
}: {
  sprint: Sprint;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const timezone = useTimezone();

  const [name, setName] = useState(sprint.name);
  const [goal, setGoal] = useState(sprint.goal ?? "");
  const [startDate, setStartDate] = useState(
    toDateInputValue(sprint.startDate, timezone),
  );
  const [endDate, setEndDate] = useState(
    toDateInputValue(sprint.endDate, timezone),
  );
  const [status, setStatus] = useState<SprintStatus>(sprint.status);
  const [pending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || pending) return;

    startTransition(async () => {
      const result = await updateSprintAction(sprint.id, {
        name: trimmed,
        goal: goal.trim() || null,
        status,
        startDate: startDate || null,
        endDate: endDate || null,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Sprint updated");
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Edit sprint</DialogTitle>
            <DialogDescription>
              Setting the status to Active makes this the sprint in progress and
              sets any current active sprint back to Planned.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-sprint-name">Name</Label>
              <Input
                id="edit-sprint-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-sprint-goal">Goal</Label>
              <Textarea
                id="edit-sprint-goal"
                value={goal}
                onChange={(event) => setGoal(event.target.value)}
                rows={2}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="edit-sprint-start">Start date</Label>
                <Input
                  id="edit-sprint-start"
                  type="date"
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-sprint-end">End date</Label>
                <Input
                  id="edit-sprint-end"
                  type="date"
                  value={endDate}
                  onChange={(event) => setEndDate(event.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-sprint-status">Status</Label>
              <Select
                value={status}
                onValueChange={(value) => setStatus(value as SprintStatus)}
              >
                <SelectTrigger id="edit-sprint-status" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SPRINT_STATUSES.map((value) => (
                    <SelectItem key={value} value={value}>
                      {SPRINT_STATUS_LABELS[value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={pending || !name.trim()}>
              {pending ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
