import { Skeleton } from "@/components/ui/skeleton";

export default function MembersLoading() {
  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-4 w-80" />
      </div>
      <div className="space-y-2 rounded-lg border p-4">
        {Array.from({ length: 5 }, (_, index) => (
          <Skeleton key={index} className="h-10 w-full" />
        ))}
      </div>
    </div>
  );
}
