"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { SidebarInner, type SidebarProps } from "./sidebar";

/**
 * Small-screen replacement for the sidebar: a top bar with a hamburger that
 * opens the full nav as a left drawer. Hidden at `md` and up, where the rail
 * shows instead.
 */
export function MobileNav(props: SidebarProps) {
  const [open, setOpen] = useState(false);

  const activeName =
    props.workspaces.find((w) => w.id === props.activeWorkspaceId)?.name ??
    "Sprintboard";

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-sidebar px-3 text-sidebar-foreground md:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Open menu"
          onClick={() => setOpen(true)}
        >
          <Menu className="size-5" />
        </Button>
        <SheetContent side="left" showCloseButton={false}>
          {/* Radix requires a title for the dialog; the nav is self-describing. */}
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SidebarInner {...props} onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 items-center gap-2">
        <div className="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary text-xs font-semibold text-primary-foreground">
          {activeName.charAt(0).toUpperCase()}
        </div>
        <span className="truncate text-sm font-semibold">{activeName}</span>
      </div>
    </header>
  );
}
