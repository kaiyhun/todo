"use client";

import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { createEpicAction } from "@/lib/actions/epics";
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
import { PRIORITIES, PRIORITY_LABELS, type Priority } from "@/lib/models/enums";

/**
 * Creates a new epic (board row) in the currently-viewed sprint, or in the
 * backlog when `sprintId` is null.
 *
 * Priority uses a Radix Select rather than a native <select>, so it's held in
 * state instead of being read out of FormData.
 */
export function CreateEpicDialog({ sprintId }: { sprintId: string | null }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [pending, startTransition] = useTransition();

  function reset() {
    setTitle("");
    setDescription("");
    setPriority("medium");
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed || pending) return;

    startTransition(async () => {
      const result = await createEpicAction({
        title: trimmed,
        description: description.trim() || undefined,
        priority,
        sprintId,
      });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Epic created");
      reset();
      setOpen(false);
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
        <Button size="sm" className="gap-1.5">
          <Plus className="size-4" />
          New epic
        </Button>
      </DialogTrigger>

      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>New epic</DialogTitle>
            <DialogDescription>
              An epic is a row on the board. Break it into tasks, then drag them
              across New → Active → Resolved → Closed.
              {sprintId === null ? " This one will be created in the backlog." : null}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="epic-title">Title</Label>
              <Input
                id="epic-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="e.g. Onboarding flow"
                autoFocus
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="epic-description">Description</Label>
              <Textarea
                id="epic-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Optional context for the team…"
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="epic-priority">Priority</Label>
              <Select
                value={priority}
                onValueChange={(value) => setPriority(value as Priority)}
              >
                <SelectTrigger id="epic-priority" className="w-full">
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
          </div>

          <DialogFooter>
            <Button type="submit" disabled={pending || !title.trim()}>
              {pending ? "Creating…" : "Create epic"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
