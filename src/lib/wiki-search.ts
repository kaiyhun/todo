/**
 * Wiki search: the result shape and the pure tree filter.
 *
 * Type-only imports, so both the server query and the sidebar Client Component
 * share this without dragging anything server-only into the browser.
 */
import type { WikiTreeNode } from "./wiki-types";

/** Minimum characters before a search runs — one letter matches everything. */
export const MIN_QUERY_LENGTH = 2;

export interface WikiSearchHit {
  pageId: string;
  /** The query appears in the page title. */
  matchedTitle: boolean;
  /** The query appears in the page's slug or one of its retired slugs. */
  matchedSlug: boolean;
  /**
   * Excerpt around the first content match, with markdown stripped. `null` when
   * the title matched (the title is already visible) or the page is empty.
   */
  snippet: string | null;
}

/**
 * Keep only the branches that lead to a match.
 *
 * A node survives if it matched **or** any of its descendants did — otherwise a
 * nested hit would appear detached from its parents. Surviving non-matching nodes
 * are rendered as dimmed context by the tree.
 *
 * A matched node's own non-matching children are dropped: the point is to show
 * where the hits are, not to re-expand the whole subtree.
 */
export function pruneTree(
  nodes: WikiTreeNode[],
  matchedIds: Set<string>,
): WikiTreeNode[] {
  const kept: WikiTreeNode[] = [];

  for (const node of nodes) {
    const children = pruneTree(node.children, matchedIds);
    if (matchedIds.has(node.id) || children.length > 0) {
      kept.push({ ...node, children });
    }
  }
  return kept;
}
