import { Skeleton } from "@/components/ui/skeleton";

/**
 * Shown in the wiki content area (the sidebar tree comes from `wiki/layout.tsx`
 * and stays put). Approximates an article: header + a few paragraphs.
 */
export default function WikiLoading() {
  return (
    <div className="mx-auto max-w-3xl space-y-4 p-6">
      <div className="flex items-start justify-between gap-3 border-b pb-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-3 w-40" />
        </div>
        <Skeleton className="h-8 w-16" />
      </div>
      <div className="space-y-3 pt-2">
        {Array.from({ length: 8 }, (_, index) => (
          <Skeleton
            key={index}
            className={index % 3 === 2 ? "h-4 w-1/2" : "h-4 w-full"}
          />
        ))}
      </div>
    </div>
  );
}
