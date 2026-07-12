"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "@/lib/navigation";
import type { User } from "@/lib/models/user";
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
}: SidebarProps & { onNavigate?: () => void }) {
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
      </div>
    </>
  );
}

/**
 * Desktop navigation rail. Hidden below `md`, where the mobile top bar's drawer
 * takes over.
 */
export function Sidebar(props: SidebarProps) {
  return (
    <aside className="hidden h-full w-60 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground md:flex">
      <SidebarInner {...props} />
    </aside>
  );
}
