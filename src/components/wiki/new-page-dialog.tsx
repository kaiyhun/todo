"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { createWikiPageAction } from "@/lib/actions/wiki";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { WikiPageOption } from "@/lib/wiki-types";

/** Radix Select forbids an empty value, so "root" means "no parent". */
const ROOT = "root";

export function NewPageDialog({ options }: { options: WikiPageOption[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [parentId, setParentId] = useState(ROOT);
  const [pending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed || pending) return;

    startTransition(async () => {
      const result = await createWikiPageAction({
        title: trimmed,
        parentId: parentId === ROOT ? null : parentId,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Page created");
      setOpen(false);
      setTitle("");
      setParentId(ROOT);
      router.push(`/wiki/${result.data.slug}/edit`);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="size-6" aria-label="New page">
          <Plus className="size-4" />
        </Button>
      </DialogTrigger>

      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>New page</DialogTitle>
            <DialogDescription>
              The URL is generated from the title. Renaming later keeps the old link
              working.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="wiki-title">Title</Label>
              <Input
                id="wiki-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="e.g. Deployment runbook"
                autoFocus
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="wiki-parent">Parent page</Label>
              <Select value={parentId} onValueChange={setParentId}>
                <SelectTrigger id="wiki-parent" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ROOT}>None (top level)</SelectItem>
                  {options.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {" ".repeat(option.depth * 2)}
                      {option.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={pending || !title.trim()}>
              {pending ? "Creating…" : "Create page"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
