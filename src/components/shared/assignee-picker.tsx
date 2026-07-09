"use client";

import { UserPlus } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getInitials } from "@/lib/format";
import type { BoardMember } from "@/lib/board-types";

/**
 * Multi-select assignee control, shared by the task detail form and the epic edit
 * dialog. Controlled: the parent owns `value` and submits it with the rest of the
 * form.
 *
 * Each item calls `preventDefault()` on select so the menu stays open while you
 * tick several people.
 */
export function AssigneePicker({
  members,
  value,
  onChange,
  disabled = false,
  id,
}: {
  members: BoardMember[];
  value: string[];
  onChange: (assigneeIds: string[]) => void;
  disabled?: boolean;
  id?: string;
}) {
  const selected = members.filter((member) => value.includes(member.id));

  function toggle(memberId: string, checked: boolean) {
    onChange(
      checked ? [...value, memberId] : value.filter((id) => id !== memberId),
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          className="h-9 w-full justify-start gap-2 font-normal"
        >
          {selected.length === 0 ? (
            <>
              <UserPlus className="size-4 text-muted-foreground" />
              <span className="text-muted-foreground">Unassigned</span>
            </>
          ) : (
            <>
              <span className="flex -space-x-1.5">
                {selected.slice(0, 4).map((member) => (
                  <Avatar key={member.id} className="size-5 ring-2 ring-background">
                    {member.image ? (
                      <AvatarImage src={member.image} alt={member.name} />
                    ) : null}
                    <AvatarFallback className="text-[9px]">
                      {getInitials(member.name)}
                    </AvatarFallback>
                  </Avatar>
                ))}
              </span>
              <span className="truncate">
                {selected.length === 1
                  ? selected[0].name
                  : `${selected.length} assignees`}
              </span>
            </>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-60">
        <DropdownMenuLabel>Assign to</DropdownMenuLabel>
        <DropdownMenuSeparator />

        {members.length === 0 ? (
          <p className="px-2 py-1.5 text-xs text-muted-foreground">
            No members in this workspace yet.
          </p>
        ) : (
          members.map((member) => (
            <DropdownMenuCheckboxItem
              key={member.id}
              checked={value.includes(member.id)}
              onCheckedChange={(checked) => toggle(member.id, Boolean(checked))}
              // Keep the menu open so several people can be ticked at once.
              onSelect={(event) => event.preventDefault()}
            >
              <span className="flex items-center gap-2">
                <Avatar className="size-5">
                  {member.image ? (
                    <AvatarImage src={member.image} alt={member.name} />
                  ) : null}
                  <AvatarFallback className="text-[9px]">
                    {getInitials(member.name)}
                  </AvatarFallback>
                </Avatar>
                {member.name}
              </span>
            </DropdownMenuCheckboxItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
