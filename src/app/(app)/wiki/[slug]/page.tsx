import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { ChevronRight, Pencil } from "lucide-react";
import { requireContext } from "@/lib/session";
import { getWikiChildCount, getWikiPageBySlug } from "@/lib/queries/wiki";
import { formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Markdown } from "@/components/wiki/markdown";
import { DeletePageButton } from "@/components/wiki/delete-page-button";

export const metadata: Metadata = { title: "Wiki" };

export default async function WikiPageRoute({
  params,
}: {
  // Next.js 16: `params` is async and must be awaited.
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { workspace } = await requireContext();

  const detail = await getWikiPageBySlug(workspace.id, slug);
  if (!detail) notFound();

  // The URL used a retired slug — send the reader to the canonical one.
  if (detail.matchedAlias) permanentRedirect(`/wiki/${detail.page.slug}`);

  const { page, breadcrumbs, updatedByName } = detail;
  const childCount = await getWikiChildCount(workspace.id, page.id);

  return (
    <article className="mx-auto max-w-3xl space-y-4 p-6">
      {breadcrumbs.length > 0 ? (
        <nav
          aria-label="Breadcrumb"
          className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground"
        >
          {breadcrumbs.map((crumb) => (
            <span key={crumb.slug} className="flex items-center gap-1">
              <Link
                href={`/wiki/${crumb.slug}`}
                className="hover:text-foreground hover:underline"
              >
                {crumb.title}
              </Link>
              <ChevronRight className="size-3" />
            </span>
          ))}
          <span className="text-foreground">{page.title}</span>
        </nav>
      ) : null}

      <header className="flex flex-wrap items-start justify-between gap-3 border-b pb-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">{page.title}</h1>
          <p className="text-xs text-muted-foreground">
            Updated by {updatedByName} on {formatDate(page.updatedAt)}
          </p>
        </div>

        <div className="flex items-center gap-1">
          <Button asChild variant="outline" size="sm" className="gap-1.5">
            <Link href={`/wiki/${page.slug}/edit`}>
              <Pencil className="size-4" />
              Edit
            </Link>
          </Button>
          <DeletePageButton
            pageId={page.id}
            title={page.title}
            childCount={childCount}
          />
        </div>
      </header>

      {page.content.trim() ? (
        <Markdown content={page.content} />
      ) : (
        <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
          This page is empty. Choose <strong>Edit</strong> to start writing.
        </p>
      )}
    </article>
  );
}
