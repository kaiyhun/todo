/**
 * Layout for all authenticated app routes.
 *
 * Resolves the current user + workspace (redirecting to /login when signed out)
 * and renders the persistent sidebar around the page content.
 *
 * `modal` is a parallel route slot (`@modal`). Intercepting routes render into
 * it, which is how /tasks/<id> appears as a dialog over the board on a soft
 * navigation while remaining a real, refreshable page.
 */
import { requireContext } from "@/lib/session";
import { isLocalMode } from "@/lib/auth/local-mode";
import {
  MAX_WORKSPACES_PER_USER,
  getWorkspacesForUser,
} from "@/lib/workspace";
import { Sidebar } from "@/components/app-shell/sidebar";
import { TimezoneProvider } from "@/components/providers/timezone-provider";

export default async function AppLayout({
  children,
  modal,
}: {
  children: React.ReactNode;
  modal: React.ReactNode;
}) {
  const { user, workspace, role } = await requireContext();
  const localMode = isLocalMode();

  // The switcher's options. LOCAL_MODE only ever has the one local workspace.
  const workspaces = localMode
    ? [{ id: workspace.id, name: workspace.name, role }]
    : (await getWorkspacesForUser(user.id))
        .map((w) => ({
          id: w._id.toString(),
          name: w.name,
          role:
            w.members.find((m) => m.userId.toString() === user.id)?.role ??
            "member",
        }))
        .sort((a, b) => a.name.localeCompare(b.name));

  // The cap counts workspaces the user *owns* (create limit; being added is uncapped).
  const ownedCount = workspaces.filter((w) => w.role === "owner").length;
  const canCreateWorkspace = !localMode && ownedCount < MAX_WORKSPACES_PER_USER;

  return (
    <TimezoneProvider timezone={workspace.timezone}>
      <div className="flex h-dvh w-full overflow-hidden">
        <Sidebar
          user={user}
          workspaces={workspaces}
          activeWorkspaceId={workspace.id}
          localMode={localMode}
          canCreateWorkspace={canCreateWorkspace}
          maxWorkspaces={MAX_WORKSPACES_PER_USER}
        />
        <main className="flex-1 overflow-y-auto">{children}</main>
        {modal}
      </div>
    </TimezoneProvider>
  );
}
