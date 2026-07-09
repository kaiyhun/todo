"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { escapeRegex } from "@/lib/text";
import type { WikiTreeNode } from "@/lib/wiki-types";
import type { WikiSearchHit } from "@/lib/wiki-search";

/**
 * Nested list of wiki pages, with the current page highlighted.
 *
 * When `matches` is supplied the tree is in search mode: nodes present in the map
 * are hits, and any other node that survived pruning is an **ancestor shown for
 * context** — rendered dimmed so it reads as a path, not a result.
 */
export function PageTree({
  nodes,
  matches = null,
  query = "",
}: {
  nodes: WikiTreeNode[];
  matches?: Map<string, WikiSearchHit> | null;
  query?: string;
}) {
  const pathname = usePathname();

  return (
    <ul className="space-y-0.5">
      {nodes.map((node) => (
        <TreeItem
          key={node.id}
          node={node}
          pathname={pathname}
          depth={0}
          matches={matches}
          query={query}
        />
      ))}
    </ul>
  );
}

/** Wraps every case-insensitive occurrence of `query` in a <mark>. */
function Highlight({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>;

  // The capture group keeps the delimiters, so parts alternate text/match.
  const parts = text.split(new RegExp(`(${escapeRegex(query)})`, "ig"));
  const needle = query.toLowerCase();

  return (
    <>
      {parts.map((part, index) =>
        part.toLowerCase() === needle ? (
          <mark
            key={index}
            className="rounded-sm bg-amber-400/40 px-0.5 text-foreground"
          >
            {part}
          </mark>
        ) : (
          <span key={index}>{part}</span>
        ),
      )}
    </>
  );
}

function TreeItem({
  node,
  pathname,
  depth,
  matches,
  query,
}: {
  node: WikiTreeNode;
  pathname: string;
  depth: number;
  matches: Map<string, WikiSearchHit> | null;
  query: string;
}) {
  const href = `/wiki/${node.slug}`;
  // The edit route should keep its page highlighted in the tree.
  const active = pathname === href || pathname === `${href}/edit`;

  const hit = matches?.get(node.id) ?? null;
  const contextOnly = matches !== null && !hit;
  const indent = 8 + depth * 14;

  return (
    <li>
      <Link
        href={href}
        aria-current={active ? "page" : undefined}
        // Indent by depth rather than nesting padding, so long titles still truncate.
        style={{ paddingLeft: `${indent}px` }}
        className={cn(
          "flex items-center gap-2 rounded-md py-1.5 pr-2 text-sm transition-colors",
          active
            ? "bg-accent font-medium text-accent-foreground"
            : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
          contextOnly && "opacity-50",
        )}
      >
        <FileText className="size-3.5 shrink-0" />
        <span className="truncate">
          {hit?.matchedTitle ? (
            <Highlight text={node.title} query={query} />
          ) : (
            node.title
          )}
        </span>
      </Link>

      {hit?.snippet ? (
        <p
          style={{ paddingLeft: `${indent + 22}px` }}
          className="line-clamp-2 pr-2 pb-1 text-[11px] leading-snug text-muted-foreground"
        >
          <Highlight text={hit.snippet} query={query} />
        </p>
      ) : hit && !hit.matchedTitle && hit.matchedSlug ? (
        // Otherwise this page would appear in the results with no visible reason.
        <p
          style={{ paddingLeft: `${indent + 22}px` }}
          className="pr-2 pb-1 text-[11px] text-muted-foreground italic"
        >
          matched in page URL
        </p>
      ) : null}

      {node.children.length > 0 ? (
        <ul className="space-y-0.5">
          {node.children.map((child) => (
            <TreeItem
              key={child.id}
              node={child}
              pathname={pathname}
              depth={depth + 1}
              matches={matches}
              query={query}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}
