import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BookOpen } from "lucide-react";
import { requireContext } from "@/lib/session";
import { getFirstWikiSlug } from "@/lib/queries/wiki";

export const metadata: Metadata = { title: "Wiki" };

/**
 * The wiki has no index of its own — it lands on the first top-level page, or
 * shows an empty state when the workspace has none.
 */
export default async function WikiIndexRoute() {
  const { workspace } = await requireContext();

  const slug = await getFirstWikiSlug(workspace.id);
  if (slug) redirect(`/wiki/${slug}`);

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-12 text-center">
      <div className="flex size-12 items-center justify-center rounded-xl border bg-muted/40">
        <BookOpen className="size-6 text-muted-foreground" />
      </div>
      <div className="space-y-1">
        <p className="font-medium">No pages yet</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          Use the <strong>+</strong> button beside “Pages” to write your first one.
          Pages are Markdown and can be nested.
        </p>
      </div>
    </div>
  );
}
