"use client";

import { useDeferredValue, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { updateWikiPageAction } from "@/lib/actions/wiki";
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
import { Markdown } from "./markdown";
import type { WikiPage } from "@/lib/models/wiki";
import type { WikiPageOption } from "@/lib/wiki-types";

/** Radix Select forbids an empty value, so "root" means "no parent". */
const ROOT = "root";

/**
 * Split-pane markdown editor: source on the left, live preview on the right.
 *
 * The preview renders from a `useDeferredValue` copy of the content, so a long
 * document re-renders at React's convenience instead of blocking every keystroke.
 *
 * `options` already excludes this page and its descendants, so the parent picker
 * cannot be used to create a cycle. The action re-checks anyway.
 */
export function WikiEditor({
  page,
  options,
}: {
  page: WikiPage;
  options: WikiPageOption[];
}) {
  const router = useRouter();

  const [title, setTitle] = useState(page.title);
  const [content, setContent] = useState(page.content);
  const [parentId, setParentId] = useState(page.parentId ?? ROOT);
  const [pending, startTransition] = useTransition();

  const previewContent = useDeferredValue(content);
  const titleChanged = title.trim() !== page.title;

  function handleSave(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed || pending) return;

    startTransition(async () => {
      const result = await updateWikiPageAction(page.id, {
        title: trimmed,
        content,
        parentId: parentId === ROOT ? null : parentId,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Page saved");
      // The slug may have changed with the title.
      router.push(`/wiki/${result.data.slug}`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSave} className="flex h-full flex-col">
      <header className="flex flex-wrap items-end gap-3 border-b p-4">
        <div className="min-w-[240px] flex-1 space-y-1.5">
          <Label htmlFor="editor-title">Title</Label>
          <Input
            id="editor-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            required
          />
          <p className="text-xs text-muted-foreground">
            {titleChanged ? (
              <>
                URL will change from <code>/wiki/{page.slug}</code> — the old link
                keeps working.
              </>
            ) : (
              <>
                URL: <code>/wiki/{page.slug}</code>
              </>
            )}
          </p>
        </div>

        <div className="w-56 space-y-1.5">
          <Label htmlFor="editor-parent">Parent page</Label>
          <Select value={parentId} onValueChange={setParentId}>
            <SelectTrigger id="editor-parent" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ROOT}>None (top level)</SelectItem>
              {options.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {" ".repeat(option.depth * 2)}
                  {option.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push(`/wiki/${page.slug}`)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={pending || !title.trim()}>
            {pending ? "Saving…" : "Save"}
          </Button>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 divide-x md:grid-cols-2">
        <section className="flex min-h-0 flex-col">
          <p className="border-b px-3 py-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Markdown
          </p>
          <Textarea
            value={content}
            onChange={(event) => setContent(event.target.value)}
            spellCheck={false}
            aria-label="Markdown source"
            placeholder="# Start writing…"
            className="min-h-0 flex-1 resize-none rounded-none border-0 bg-transparent font-mono text-sm shadow-none focus-visible:ring-0"
          />
        </section>

        <section className="flex min-h-0 flex-col">
          <p className="border-b px-3 py-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Preview
          </p>
          <div className="flex-1 overflow-y-auto p-4">
            {previewContent.trim() ? (
              <Markdown content={previewContent} />
            ) : (
              <p className="text-sm text-muted-foreground">Nothing to preview yet.</p>
            )}
          </div>
        </section>
      </div>
    </form>
  );
}
