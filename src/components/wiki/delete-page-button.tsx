"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteWikiPageAction } from "@/lib/actions/wiki";
import { Button } from "@/components/ui/button";
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

/**
 * Deletes a page. Children are lifted up to this page's parent rather than being
 * deleted with it, so the warning says exactly that.
 */
export function DeletePageButton({
  pageId,
  title,
  childCount,
}: {
  pageId: string;
  title: string;
  childCount: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteWikiPageAction(pageId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Page deleted");
      router.push(
        result.data.parentSlug ? `/wiki/${result.data.parentSlug}` : "/wiki",
      );
      router.refresh();
    });
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5 text-destructive">
          <Trash2 className="size-4" />
          Delete
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete “{title}”?</AlertDialogTitle>
          <AlertDialogDescription>
            {childCount > 0
              ? `This page has ${childCount} child ${childCount === 1 ? "page" : "pages"}. They will be kept and moved up to this page's parent. This cannot be undone.`
              : "This permanently deletes the page. This cannot be undone."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(event) => {
              event.preventDefault();
              handleDelete();
            }}
            disabled={pending}
          >
            {pending ? "Deleting…" : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
