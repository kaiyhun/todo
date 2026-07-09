/**
 * Wiki shell: a searchable page tree on the left, the active page on the right.
 *
 * The tree lives in the layout, so wiki actions call
 * `revalidatePath("/wiki", "layout")` to refresh it. Layouts don't receive
 * `searchParams`, which is why sidebar search is client state backed by a Server
 * Action rather than a `?q=` URL filter.
 */
import { requireContext } from "@/lib/session";
import { getWikiPageOptions, getWikiTree } from "@/lib/queries/wiki";
import { WikiSidebar } from "@/components/wiki/wiki-sidebar";

export default async function WikiLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { workspace } = await requireContext();

  const [tree, options] = await Promise.all([
    getWikiTree(workspace.id),
    getWikiPageOptions(workspace.id),
  ]);

  return (
    <div className="flex h-full">
      <WikiSidebar tree={tree} options={options} />
      <div className="min-w-0 flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}
