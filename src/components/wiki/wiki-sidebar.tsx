"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { PanelLeft, Search, X } from "lucide-react";
import { searchWikiPagesAction } from "@/lib/actions/wiki";
import {
  MIN_QUERY_LENGTH,
  pruneTree,
  type WikiSearchHit,
} from "@/lib/wiki-search";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { PageTree } from "./page-tree";
import { NewPageDialog } from "./new-page-dialog";
import type { WikiPageOption, WikiTreeNode } from "@/lib/wiki-types";

/** How long to wait after the last keystroke before searching. */
const DEBOUNCE_MS = 250;

/**
 * The wiki sidebar: a search box above the page tree.
 *
 * Search state is local rather than in the URL, because the tree is rendered by
 * `wiki/layout.tsx` and Next.js layouts never receive `searchParams`. Results come
 * from a debounced Server Action; the tree is then pruned to the matching branches
 * (with their ancestors kept as context).
 */
export function WikiSidebar({
  tree,
  options,
}: {
  tree: WikiTreeNode[];
  options: WikiPageOption[];
}) {
  const [query, setQuery] = useState("");
  /** `null` means "not searching" — render the whole tree. */
  const [hits, setHits] = useState<WikiSearchHit[] | null>(null);
  const [pending, startTransition] = useTransition();
  /** Small-screen "Pages" drawer. */
  const [mobileOpen, setMobileOpen] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestQueryRef = useRef("");

  // Only clears a timer — no setState, so this doesn't cascade renders.
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  function handleChange(value: string) {
    setQuery(value);
    latestQueryRef.current = value;
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const trimmed = value.trim();
    if (trimmed.length < MIN_QUERY_LENGTH) {
      setHits(null);
      return;
    }

    debounceRef.current = setTimeout(() => {
      startTransition(async () => {
        const result = await searchWikiPagesAction(trimmed);
        // Drop a response the user has already typed past.
        if (latestQueryRef.current.trim() !== trimmed) return;
        setHits(result.ok ? result.data : []);
      });
    }, DEBOUNCE_MS);
  }

  const matches = useMemo(
    () => (hits ? new Map(hits.map((hit) => [hit.pageId, hit])) : null),
    [hits],
  );

  const visibleTree = useMemo(
    () => (matches ? pruneTree(tree, new Set(matches.keys())) : tree),
    [tree, matches],
  );

  const searching = query.trim().length >= MIN_QUERY_LENGTH;

  // Shared between the desktop rail and the mobile drawer.
  const content = (
    <>
      <div className="flex h-12 items-center justify-between border-b px-3">
        <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Pages
        </h2>
        <NewPageDialog options={options} />
      </div>

      <div className="border-b p-2">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={query}
            onChange={(event) => handleChange(event.target.value)}
            placeholder="Search pages…"
            aria-label="Search pages"
            className="h-8 pr-8 pl-8 text-sm"
          />
          {query ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Clear search"
              onClick={() => handleChange("")}
              className="absolute top-1/2 right-0.5 size-7 -translate-y-1/2"
            >
              <X className="size-3.5" />
            </Button>
          ) : null}
        </div>

        {searching ? (
          <p className="mt-1.5 px-1 text-[11px] text-muted-foreground">
            {pending
              ? "Searching…"
              : hits
                ? `${hits.length} ${hits.length === 1 ? "page" : "pages"} matched`
                : null}
          </p>
        ) : null}
      </div>

      <nav className="flex-1 overflow-y-auto p-2">
        {visibleTree.length > 0 ? (
          <PageTree
            nodes={visibleTree}
            matches={matches}
            query={searching ? query.trim() : ""}
          />
        ) : searching ? (
          <p className="px-2 py-1.5 text-xs text-muted-foreground">
            No pages match “{query.trim()}”.
          </p>
        ) : (
          <p className="px-2 py-1.5 text-xs text-muted-foreground">No pages yet.</p>
        )}
      </nav>
    </>
  );

  return (
    <>
      {/* Desktop rail */}
      <aside className="hidden w-64 shrink-0 flex-col border-r md:flex">
        {content}
      </aside>

      {/* Mobile: a "Pages" button opening the tree as a left drawer */}
      <div className="border-b p-2 md:hidden">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => setMobileOpen(true)}
          >
            <PanelLeft className="size-4" />
            Pages
          </Button>
          <SheetContent
            side="left"
            showCloseButton={false}
            className="bg-background text-foreground"
            // Close the drawer when a page link is tapped (delegated, so it also
            // covers the recursively-rendered tree without threading a callback).
            onClick={(event) => {
              if ((event.target as HTMLElement).closest("a")) {
                setMobileOpen(false);
              }
            }}
          >
            <SheetTitle className="sr-only">Wiki pages</SheetTitle>
            {content}
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
