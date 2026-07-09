/**
 * Small presentational pieces shared across the board: the status badge (also
 * used for an epic's derived status), the priority badge, and a stack of
 * assignee avatars.
 */
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getInitials } from "@/lib/format";
import type { BoardMember } from "@/lib/board-types";
import {
  PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  type Priority,
  type TaskStatus,
} from "@/lib/models/enums";

const STATUS_STYLES: Record<TaskStatus, string> = {
  new: "bg-slate-500/15 text-slate-700 dark:text-slate-300",
  active: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  resolved: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  closed: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
};

const PRIORITY_STYLES: Record<Priority, string> = {
  urgent: "bg-red-500/15 text-red-600 dark:text-red-400",
  high: "bg-orange-500/15 text-orange-600 dark:text-orange-400",
  medium: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  low: "bg-muted text-muted-foreground",
};

export function StatusBadge({
  status,
  className,
}: {
  status: TaskStatus;
  className?: string;
}) {
  return (
    <Badge
      variant="secondary"
      className={cn("border-0", STATUS_STYLES[status], className)}
    >
      {TASK_STATUS_LABELS[status]}
    </Badge>
  );
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <Badge variant="secondary" className={cn("border-0", PRIORITY_STYLES[priority])}>
      {PRIORITY_LABELS[priority]}
    </Badge>
  );
}

/** Overlapping avatars for a task's assignees; silently skips unknown ids. */
export function AssigneeAvatars({
  assigneeIds,
  members,
  max = 3,
}: {
  assigneeIds: string[];
  members: BoardMember[];
  max?: number;
}) {
  const assigned = assigneeIds
    .map((id) => members.find((member) => member.id === id))
    .filter((member): member is BoardMember => Boolean(member));

  if (assigned.length === 0) return null;

  const shown = assigned.slice(0, max);
  const overflow = assigned.length - shown.length;

  return (
    <div className="flex -space-x-1.5">
      {shown.map((member) => (
        <Avatar
          key={member.id}
          className="size-5 ring-2 ring-background"
          title={member.name}
        >
          {member.image ? (
            <AvatarImage src={member.image} alt={member.name} />
          ) : null}
          <AvatarFallback className="text-[9px]">
            {getInitials(member.name)}
          </AvatarFallback>
        </Avatar>
      ))}
      {overflow > 0 ? (
        <span className="flex size-5 items-center justify-center rounded-full bg-muted text-[9px] ring-2 ring-background">
          +{overflow}
        </span>
      ) : null}
    </div>
  );
}
