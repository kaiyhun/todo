/**
 * Session helpers — the single way the app answers "who is the current user and
 * which workspace are they in?".
 *
 * Every reader here honours LOCAL_MODE: when it is on we skip Auth.js entirely
 * and return the singleton local identity, transparently to callers.
 */
import "server-only";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { isLocalMode } from "@/lib/auth/local-mode";
import { ensureLocalUser, ensureLocalWorkspace } from "@/lib/auth/local-context";
import { getWorkspaceForUser, createWorkspaceForUser } from "@/lib/workspace";
import { serializeUser, type User } from "@/lib/models/user";
import { serializeWorkspace, type Workspace } from "@/lib/models/workspace";

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
 * The current user together with their active workspace. If a signed-in user has
 * no workspace yet, one is created for them so the app always has a context.
 * Returns `null` only when there is no user at all.
 */
export async function getCurrentContext(): Promise<{
  user: User;
  workspace: Workspace;
} | null> {
  if (isLocalMode()) {
    const [userDoc, workspaceDoc] = await Promise.all([
      ensureLocalUser(),
      ensureLocalWorkspace(),
    ]);
    return {
      user: serializeUser(userDoc),
      workspace: serializeWorkspace(workspaceDoc),
    };
  }

  const user = await getCurrentUser();
  if (!user) return null;

  const workspaceDoc =
    (await getWorkspaceForUser(user.id)) ??
    (await createWorkspaceForUser(`${user.name}'s Workspace`, user.id));

  return { user, workspace: serializeWorkspace(workspaceDoc) };
}

/** As `getCurrentContext` but redirects to /login when signed out. */
export async function requireContext(): Promise<{
  user: User;
  workspace: Workspace;
}> {
  const context = await getCurrentContext();
  if (!context) redirect("/login");
  return context;
}
