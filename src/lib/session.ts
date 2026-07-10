/**
 * Session helpers — the single way the app answers "who is the current user,
 * which workspace are they in, and what may they do there?".
 *
 * Every reader here honours LOCAL_MODE: when it is on we skip Auth.js entirely
 * and return the singleton local identity, transparently to callers.
 */
import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { isLocalMode } from "@/lib/auth/local-mode";
import { ensureLocalUser, ensureLocalWorkspace } from "@/lib/auth/local-context";
import {
  ACTIVE_WORKSPACE_COOKIE,
  createWorkspaceForUser,
  getWorkspacesForUser,
  isWorkspaceOwner,
} from "@/lib/workspace";
import { findWorkspaceRole } from "@/lib/permissions";
import { serializeUser, type User } from "@/lib/models/user";
import {
  serializeWorkspace,
  type Workspace,
  type WorkspaceRole,
} from "@/lib/models/workspace";

/** The current user, their workspace, and their role within it. */
export interface AppContext {
  user: User;
  workspace: Workspace;
  role: WorkspaceRole;
}

/** The current user, or `null` when signed out. */
export async function getCurrentUser(): Promise<User | null> {
  if (isLocalMode()) {
    return serializeUser(await ensureLocalUser());
  }

  const session = await auth();
  if (!session?.user?.id) return null;

  return {
    id: session.user.id,
    email: session.user.email ?? "",
    name: session.user.name ?? "",
    image: session.user.image ?? undefined,
    role: session.user.role,
  };
}

/** The current user or a redirect to /login. Use to guard Server Components. */
export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/**
 * The current user together with their active workspace and role. If a signed-in
 * user has no workspace yet, one is created for them so the app always has a
 * context. Returns `null` only when there is no user at all.
 */
export async function getCurrentContext(): Promise<AppContext | null> {
  if (isLocalMode()) {
    const [userDoc, workspaceDoc] = await Promise.all([
      ensureLocalUser(),
      ensureLocalWorkspace(),
    ]);
    return {
      user: serializeUser(userDoc),
      workspace: serializeWorkspace(workspaceDoc),
      // Authentication is disabled, so the local user has full control — even if
      // a seed rewrote the workspace's member list without them.
      role: "owner",
    };
  }

  const user = await getCurrentUser();
  if (!user) return null;

  let workspaceDocs = await getWorkspacesForUser(user.id);
  if (workspaceDocs.length === 0) {
    workspaceDocs = [
      await createWorkspaceForUser(`${user.name}'s Workspace`, user.id),
    ];
  }

  // Which of the user's workspaces is active: the one named by the cookie (while
  // they still belong to it), else one they *own* — so being added to someone
  // else's board never silently replaces their own — else the first.
  const activeId = (await cookies()).get(ACTIVE_WORKSPACE_COOKIE)?.value;
  const workspaceDoc =
    workspaceDocs.find((w) => w._id.toString() === activeId) ??
    workspaceDocs.find((w) => isWorkspaceOwner(w, user.id)) ??
    workspaceDocs[0];

  const workspace = serializeWorkspace(workspaceDoc);
  // Membership matched above, so a role is expected; fall back to the least
  // privileged one rather than throwing.
  const role = findWorkspaceRole(workspace, user.id) ?? "member";

  return { user, workspace, role };
}

/** As `getCurrentContext` but redirects to /login when signed out. */
export async function requireContext(): Promise<AppContext> {
  const context = await getCurrentContext();
  if (!context) redirect("/login");
  return context;
}
