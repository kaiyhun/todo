"use client";

import { useState, useTransition } from "react";
import { Crown, MoreHorizontal, UserMinus } from "lucide-react";
import { toast } from "sonner";
import {
  removeMemberAction,
  transferOwnershipAction,
  updateMemberRoleAction,
} from "@/lib/actions/members";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate, getInitials } from "@/lib/format";
import {
  ROLE_LABELS,
  canActOnMember,
  canTransferOwnership,
} from "@/lib/permissions";
import type { WorkspaceRole } from "@/lib/models/workspace";
import type { MemberRow } from "@/lib/member-types";

/** Which confirmation dialog is open, and for whom. */
type PendingConfirm =
  | { kind: "remove"; member: MemberRow }
  | { kind: "transfer"; member: MemberRow }
  | null;

/**
 * The workspace roster.
 *
 * Controls are hidden according to the same predicates the Server Actions
 * enforce — hiding is a courtesy, the action is the boundary.
 */
export function MembersTable({
  rows,
  currentUserId,
  currentRole,
}: {
  rows: MemberRow[];
  currentUserId: string;
  currentRole: WorkspaceRole;
}) {
  const [confirm, setConfirm] = useState<PendingConfirm>(null);
  const [pending, startTransition] = useTransition();

  function changeRole(member: MemberRow, role: WorkspaceRole) {
    startTransition(async () => {
      const result = await updateMemberRoleAction({ userId: member.id, role });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`${member.name} is now ${ROLE_LABELS[role].toLowerCase()}`);
    });
  }

  function runConfirm() {
    if (!confirm) return;
    const { kind, member } = confirm;

    startTransition(async () => {
      const result =
        kind === "remove"
          ? await removeMemberAction(member.id)
          : await transferOwnershipAction(member.id);

      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(
        kind === "remove"
          ? `${member.name} removed and unassigned`
          : `${member.name} is now the owner`,
      );
      setConfirm(null);
    });
  }

  return (
    <>
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Member</TableHead>
              <TableHead>Email</TableHead>
              <TableHead className="w-[160px]">Role</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead className="w-[52px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((member) => {
              const isSelf = member.id === currentUserId;
              const mayActOnThem = canActOnMember(currentRole, member.role) && !isSelf;
              const mayTransferToThem =
                canTransferOwnership(currentRole) &&
                !isSelf &&
                member.role !== "owner";

              return (
                <TableRow key={member.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar className="size-7">
                        {member.image ? (
                          <AvatarImage src={member.image} alt={member.name} />
                        ) : null}
                        <AvatarFallback className="text-xs">
                          {getInitials(member.name)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium">{member.name}</span>
                      {isSelf ? (
                        <Badge variant="secondary" className="text-[10px]">
                          You
                        </Badge>
                      ) : null}
                    </div>
                  </TableCell>

                  <TableCell className="text-muted-foreground">
                    {member.email}
                  </TableCell>

                  <TableCell>
                    {member.role === "owner" ? (
                      <Badge variant="secondary" className="gap-1">
                        <Crown className="size-3" />
                        Owner
                      </Badge>
                    ) : mayActOnThem ? (
                      <Select
                        value={member.role}
                        disabled={pending}
                        onValueChange={(value) =>
                          changeRole(member, value as WorkspaceRole)
                        }
                      >
                        <SelectTrigger
                          className="h-8 w-[130px]"
                          aria-label={`Role for ${member.name}`}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="member">Member</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge variant="outline">{ROLE_LABELS[member.role]}</Badge>
                    )}
                  </TableCell>

                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {formatDate(member.joinedAt)}
                  </TableCell>

                  <TableCell>
                    {mayActOnThem || mayTransferToThem ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7"
                            aria-label={`Actions for ${member.name}`}
                          >
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {mayTransferToThem ? (
                            <DropdownMenuItem
                              onSelect={(event) => {
                                event.preventDefault();
                                setConfirm({ kind: "transfer", member });
                              }}
                            >
                              <Crown className="size-4" />
                              Transfer ownership
                            </DropdownMenuItem>
                          ) : null}
                          {mayActOnThem ? (
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onSelect={(event) => {
                                event.preventDefault();
                                setConfirm({ kind: "remove", member });
                              }}
                            >
                              <UserMinus className="size-4" />
                              Remove from workspace
                            </DropdownMenuItem>
                          ) : null}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : null}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <AlertDialog
        open={confirm !== null}
        onOpenChange={(open) => {
          if (!open) setConfirm(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm?.kind === "remove"
                ? `Remove ${confirm.member.name}?`
                : `Make ${confirm?.member.name} the owner?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.kind === "remove"
                ? "They lose access to this workspace and are unassigned from every task and epic in it. Tasks they reported keep their name as reporter."
                : "They become the owner and you step down to admin. Only the owner can transfer ownership, so you can't undo this yourself."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                runConfirm();
              }}
              disabled={pending}
            >
              {pending
                ? "Working…"
                : confirm?.kind === "remove"
                  ? "Remove"
                  : "Transfer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
