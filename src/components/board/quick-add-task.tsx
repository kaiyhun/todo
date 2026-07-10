"use client";

import { useRef, useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { createTaskAction } from "@/lib/actions/tasks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Inline "add task" affordance, rendered in each row's **New** cell — tasks are
 * always created there and then dragged onward.
 *
 * Stays open after a successful add and re-focuses the input, so a batch of
 * tasks can be typed in quickly.
 */
export function QuickAddTask({ epicId }: { epicId: string }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed || pending) return;

    startTransition(async () => {
      const result = await createTaskAction({
        epicId,
        title: trimmed,
        status: "new",
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setTitle("");
      inputRef.current?.focus();
    });
  }

  if (!open) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        // Grow to fill the rest of the (row-height) New cell so the affordance
        // spans the row instead of floating short at the top. Label stays top-left.
        className="min-h-7 w-full flex-1 items-start justify-start gap-1 pt-1.5 text-xs text-muted-foreground"
        onClick={() => {
          setOpen(true);
          // Focus once the input has mounted.
          requestAnimationFrame(() => inputRef.current?.focus());
        }}
      >
        <Plus className="size-3.5" />
        Add task
      </Button>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-1.5">
      <Input
        ref={inputRef}
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setOpen(false);
            setTitle("");
          }
        }}
        placeholder="Task title…"
        aria-label="New task title"
        disabled={pending}
        className="h-7 text-xs"
      />
      <div className="flex gap-1">
        <Button type="submit" size="sm" className="h-6 flex-1 text-xs" disabled={pending}>
          {pending ? "Adding…" : "Add"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-6 text-xs"
          onClick={() => {
            setOpen(false);
            setTitle("");
          }}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
