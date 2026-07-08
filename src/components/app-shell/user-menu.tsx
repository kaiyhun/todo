"use client";

import { LogOut } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { User } from "@/lib/models/user";
import { getInitials } from "@/lib/format";
import { logoutAction } from "@/lib/actions/auth";

/**
 * Avatar + dropdown showing the signed-in user with a sign-out action.
 * In LOCAL_MODE there is no session to end, so sign-out is hidden.
 */
export function UserMenu({
  user,
  canSignOut,
}: {
  user: User;
  canSignOut: boolean;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="h-auto min-w-0 flex-1 justify-start gap-2 px-2 py-1.5"
        >
          <Avatar className="size-7">
            {user.image ? <AvatarImage src={user.image} alt={user.name} /> : null}
            <AvatarFallback className="text-xs">
              {getInitials(user.name)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 text-left">
            <p className="truncate text-sm font-medium leading-tight">
              {user.name}
            </p>
            <p className="truncate text-xs text-muted-foreground leading-tight">
              {user.email}
            </p>
          </div>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel className="truncate">{user.email}</DropdownMenuLabel>
        {canSignOut ? (
          <>
            <DropdownMenuSeparator />
            {/* Sign-out is a Server Action, so submit it via a form. */}
            <form action={logoutAction}>
              <DropdownMenuItem asChild>
                <button type="submit" className="w-full cursor-pointer">
                  <LogOut className="size-4" />
                  Sign out
                </button>
              </DropdownMenuItem>
            </form>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
