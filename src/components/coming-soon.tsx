import type { LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";

/**
 * Placeholder for sections delivered in a later milestone. Keeps the navigation
 * complete and honest about what is / isn't built yet.
 */
export function ComingSoon({
  title,
  description,
  milestone,
  icon: Icon,
}: {
  title: string;
  description: string;
  milestone: string;
  icon: LucideIcon;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="flex size-14 items-center justify-center rounded-2xl border bg-muted/40">
        <Icon className="size-7 text-muted-foreground" />
      </div>
      <div className="space-y-1">
        <div className="flex items-center justify-center gap-2">
          <h1 className="text-xl font-semibold">{title}</h1>
          <Badge variant="secondary">{milestone}</Badge>
        </div>
        <p className="max-w-md text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}
