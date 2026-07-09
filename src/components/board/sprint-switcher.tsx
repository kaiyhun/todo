"use client";

import { useRouter } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BACKLOG_VIEW } from "@/lib/board-types";
import type { Sprint } from "@/lib/models/sprint";

const SPRINT_STATUS_LABELS: Record<Sprint["status"], string> = {
  active: "Active",
  planned: "Planned",
  completed: "Completed",
};

/**
 * Chooses which sprint the board shows. The selection lives in the URL
 * (`/board?sprint=<id>`), so a particular sprint's board is shareable and
 * survives a refresh.
 */
export function SprintSwitcher({
  sprints,
  view,
  backlogEpicCount,
}: {
  sprints: Sprint[];
  view: string;
  backlogEpicCount: number;
}) {
  const router = useRouter();

  return (
    <Select
      value={view}
      onValueChange={(next) => router.push(`/board?sprint=${next}`)}
    >
      <SelectTrigger className="w-[260px]" aria-label="Select sprint">
        <SelectValue placeholder="Select a sprint" />
      </SelectTrigger>
      <SelectContent>
        {sprints.map((sprint) => (
          <SelectItem key={sprint.id} value={sprint.id}>
            {sprint.name}
            <span className="ml-2 text-xs text-muted-foreground">
              {SPRINT_STATUS_LABELS[sprint.status]}
            </span>
          </SelectItem>
        ))}
        <SelectItem value={BACKLOG_VIEW}>
          Backlog
          <span className="ml-2 text-xs text-muted-foreground">
            {backlogEpicCount} {backlogEpicCount === 1 ? "epic" : "epics"}
          </span>
        </SelectItem>
      </SelectContent>
    </Select>
  );
}
