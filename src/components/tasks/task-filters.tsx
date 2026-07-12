"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PRIORITIES,
  PRIORITY_LABELS,
  TASK_STATUSES,
  TASK_STATUS_LABELS,
} from "@/lib/models/enums";
import type { BoardMember } from "@/lib/board-types";
import type { EpicOption } from "@/lib/task-types";

/** Radix Select forbids an empty-string value, so "all" is the cleared sentinel. */
const ALL = "all";

/**
 * Search + filter controls for the tasks table.
 *
 * All state lives in the URL, so a filtered view is shareable, survives a
 * refresh, and is applied server-side by `getTasksList`.
 */
export function TaskFilters({
  members,
  epics,
}: {
  members: BoardMember[];
  epics: EpicOption[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [query, setQuery] = useState(searchParams.get("q") ?? "");

  const setParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (!value || value === ALL) {
        params.delete(key);
      } else {
        params.set(key, value);
      }
      const search = params.toString();
      router.replace(search ? `${pathname}?${search}` : pathname, {
        scroll: false,
      });
    },
    [router, pathname, searchParams],
  );

  // Debounce the search box so typing doesn't fire a request per keystroke.
  useEffect(() => {
    const current = searchParams.get("q") ?? "";
    if (query === current) return;

    const timer = setTimeout(() => setParam("q", query), 300);
    return () => clearTimeout(timer);
  }, [query, searchParams, setParam]);

  const status = searchParams.get("status") ?? ALL;
  const priority = searchParams.get("priority") ?? ALL;
  const assignee = searchParams.get("assignee") ?? ALL;
  const epic = searchParams.get("epic") ?? ALL;
  const hasFilters =
    Boolean(searchParams.get("q")) ||
    [status, priority, assignee, epic].some((value) => value !== ALL);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative w-full sm:w-auto">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search tasks…"
          aria-label="Search tasks"
          className="w-full pl-8 sm:w-56"
        />
      </div>

      <Select value={status} onValueChange={(value) => setParam("status", value)}>
        <SelectTrigger className="w-[140px]" aria-label="Filter by status">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All statuses</SelectItem>
          {TASK_STATUSES.map((value) => (
            <SelectItem key={value} value={value}>
              {TASK_STATUS_LABELS[value]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={priority} onValueChange={(value) => setParam("priority", value)}>
        <SelectTrigger className="w-[145px]" aria-label="Filter by priority">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All priorities</SelectItem>
          {PRIORITIES.map((value) => (
            <SelectItem key={value} value={value}>
              {PRIORITY_LABELS[value]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={assignee} onValueChange={(value) => setParam("assignee", value)}>
        <SelectTrigger className="w-[160px]" aria-label="Filter by assignee">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All assignees</SelectItem>
          {members.map((member) => (
            <SelectItem key={member.id} value={member.id}>
              {member.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={epic} onValueChange={(value) => setParam("epic", value)}>
        <SelectTrigger className="w-[180px]" aria-label="Filter by epic">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All epics</SelectItem>
          {epics.map((option) => (
            <SelectItem key={option.id} value={option.id}>
              {option.title}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {hasFilters ? (
        <Button
          variant="ghost"
          size="sm"
          className="gap-1"
          onClick={() => {
            setQuery("");
            router.replace(pathname, { scroll: false });
          }}
        >
          <X className="size-3.5" />
          Clear
        </Button>
      ) : null}
    </div>
  );
}
