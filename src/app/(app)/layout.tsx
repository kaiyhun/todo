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
import { Sidebar } from "@/components/app-shell/sidebar";

export default async function AppLayout({
  children,
  modal,
}: {
  children: React.ReactNode;
  modal: React.ReactNode;
}) {
  const { user, workspace } = await requireContext();

  return (
    <div className="flex h-dvh w-full overflow-hidden">
      <Sidebar user={user} workspace={workspace} localMode={isLocalMode()} />
      <main className="flex-1 overflow-y-auto">{children}</main>
      {modal}
    </div>
  );
}
