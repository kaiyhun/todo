import Link from "next/link";
import { FileQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * In-app 404 — e.g. a task or wiki page id that no longer exists (`notFound()`
 * in `tasks/[taskId]`, `wiki/[slug]`, …). Rendered inside the authenticated
 * layout, so the sidebar stays put.
 */
export default function AppNotFound() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="flex size-12 items-center justify-center rounded-xl border bg-muted/40">
        <FileQuestion className="size-6 text-muted-foreground" />
      </div>
      <div className="space-y-1">
        <h1 className="text-lg font-semibold">Not found</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          This item doesn&apos;t exist or was deleted.
        </p>
      </div>
      <Button asChild>
        <Link href="/dashboard">Back to dashboard</Link>
      </Button>
    </div>
  );
}
