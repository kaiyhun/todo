import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-72" />
      </div>
      {/* Per-column count cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-24 w-full rounded-xl" />
        ))}
      </div>
      {/* Active sprint + recent activity */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-48 w-full rounded-xl lg:col-span-1" />
        <Skeleton className="h-48 w-full rounded-xl lg:col-span-2" />
      </div>
    </div>
  );
}
