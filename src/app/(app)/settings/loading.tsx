import { Skeleton } from "@/components/ui/skeleton";

export default function SettingsLoading() {
  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-4 w-64" />
      </div>
      {/* Workspace + Profile sections */}
      {Array.from({ length: 2 }, (_, index) => (
        <div key={index} className="space-y-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-56 w-full rounded-lg" />
        </div>
      ))}
    </div>
  );
}
