import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requireContext } from "@/lib/session";
import { getWikiPageBySlug, getWikiPageOptions } from "@/lib/queries/wiki";
import { WikiEditor } from "@/components/wiki/wiki-editor";

export const metadata: Metadata = { title: "Edit page" };

export default async function WikiEditRoute({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { workspace } = await requireContext();

  const detail = await getWikiPageBySlug(workspace.id, slug);
  if (!detail) notFound();
  if (detail.matchedAlias) redirect(`/wiki/${detail.page.slug}/edit`);

  // Excludes this page and its descendants, so the picker can't create a cycle.
  const options = await getWikiPageOptions(workspace.id, detail.page.id);

  return <WikiEditor page={detail.page} options={options} />;
}
