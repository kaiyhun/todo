"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "@/lib/navigation";
import type { User } from "@/lib/models/user";
import { Button } from "@/components/ui/button";
import { SIDEBAR_COLLAPSED_COOKIE } from "@/lib/ui-prefs";
import { UserMenu } from "./user-menu";
import {
  WorkspaceSwitcher,
  type WorkspaceOption,
} from "./workspace-switcher";
import { ThemeToggle } from "@/components/theme-toggle";

export type SidebarProps = {
  user: User;
  workspaces: WorkspaceOption[];
  activeWorkspaceId: string;
  localMode: boolean;
  canCreateWorkspace: boolean;
  maxWorkspaces: number;
};

/**
 * The sidebar's content — workspace switcher, primary nav, footer. Shared by the
 * desktop rail and the mobile drawer. `onNavigate` lets the drawer close itself
 * when a link is tapped.
 */
export function SidebarInner({
  user,
  workspaces,
  activeWorkspaceId,
  localMode,
  canCreateWorkspace,
  maxWorkspaces,
  onNavigate,
  onCollapse,
}: SidebarProps & { onNavigate?: () => void; onCollapse?: () => void }) {
  const pathname = usePathname();

  return (
    <>
      <WorkspaceSwitcher
        workspaces={workspaces}
        activeId={activeWorkspaceId}
        localMode={localMode}
        canCreate={canCreateWorkspace}
        maxWorkspaces={maxWorkspaces}
      />

      <nav className="flex-1 space-y-0.5 overflow-y-auto p-2">
        {NAV_ITEMS.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
              )}
            >
              <Icon className="size-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="flex items-center gap-1 border-t p-2">
        <UserMenu user={user} canSignOut={!localMode} />
        <ThemeToggle />
        {onCollapse ? (
          <Button
            variant="ghost"
            size="icon"
            aria-label="Collapse sidebar"
            onClick={onCollapse}
            className="text-muted-foreground"
          >
            <PanelLeftClose className="size-4" />
          </Button>
        ) : null}
      </div>
    </>
  );
}

/**
 * Desktop navigation rail. Hidden below `md` (the mobile top bar's drawer takes
 * over there); on `md+` it can also be collapsed to reclaim width, remembered in
 * a cookie so it survives reloads. When collapsed, a small edge tab brings it back.
 */
export function Sidebar({
  defaultCollapsed,
  ...props
}: SidebarProps & { defaultCollapsed: boolean }) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  function update(next: boolean) {
    setCollapsed(next);
    // A plain cookie (no server action needed) — the layout reads it for the
    // initial render, so there's no expand/collapse flash on reload.
    document.cookie = `${SIDEBAR_COLLAPSED_COOKIE}=${next ? "1" : "0"}; path=/; max-age=31536000; samesite=lax`;
  }

  if (collapsed) {
    return (
      <button
        type="button"
        aria-label="Show sidebar"
        onClick={() => update(false)}
        className="fixed top-1/2 left-0 z-30 hidden -translate-y-1/2 items-center rounded-r-lg border border-l-0 bg-sidebar p-1.5 text-muted-foreground shadow-sm transition-colors hover:text-foreground md:flex"
      >
        <PanelLeftOpen className="size-4" />
      </button>
    );
  }

  return (
    <aside className="hidden h-full w-60 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground md:flex">
      <SidebarInner {...props} onCollapse={() => update(true)} />
    </aside>
  );
}
