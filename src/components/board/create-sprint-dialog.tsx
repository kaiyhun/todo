"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus } from "lucide-react";
import { toast } from "sonner";
import { createSprintAction } from "@/lib/actions/sprints";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import {
  SPRINT_STATUSES,
  SPRINT_STATUS_LABELS,
  type SprintStatus,
} from "@/lib/models/enums";

/** Create a sprint, then switch the board to it. */
export function CreateSprintDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [goal, setGoal] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [status, setStatus] = useState<SprintStatus>("planned");
  const [pending, startTransition] = useTransition();

  function reset() {
    setName("");
    setGoal("");
    setStartDate("");
    setEndDate("");
    setStatus("planned");
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || pending) return;

    startTransition(async () => {
      const result = await createSprintAction({
        name: trimmed,
        goal: goal.trim() || undefined,
        status,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Sprint created");
      reset();
      setOpen(false);
      // Land the board on the new (empty) sprint.
      router.push(`/board?sprint=${result.data.id}`);
      router.refresh();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5">
          <CalendarPlus className="size-4" />
          New sprint
        </Button>
      </DialogTrigger>

      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>New sprint</DialogTitle>
            <DialogDescription>
              A time-boxed iteration that groups epics. Create epics in it while
              it&apos;s selected, or move existing epics in from an epic&apos;s menu.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="sprint-name">Name</Label>
              <Input
                id="sprint-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. Sprint 13 — Billing"
                autoFocus
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="sprint-goal">Goal</Label>
              <Textarea
                id="sprint-goal"
                value={goal}
                onChange={(event) => setGoal(event.target.value)}
                placeholder="Optional — what this sprint aims to ship…"
                rows={2}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="sprint-start">Start date</Label>
                <Input
                  id="sprint-start"
                  type="date"
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sprint-end">End date</Label>
                <Input
                  id="sprint-end"
                  type="date"
                  value={endDate}
                  onChange={(event) => setEndDate(event.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="sprint-status">Status</Label>
              <Select
                value={status}
                onValueChange={(value) => setStatus(value as SprintStatus)}
              >
                <SelectTrigger id="sprint-status" className="w-full">
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
              {status === "active" ? (
                <p className="text-xs text-muted-foreground">
                  This becomes the active sprint; any current active sprint is set
                  back to Planned.
                </p>
              ) : null}
            </div>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={pending || !name.trim()}>
              {pending ? "Creating…" : "Create sprint"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
