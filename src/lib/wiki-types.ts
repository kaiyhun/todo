/**
 * Types shared by the wiki's Server Components and its Client Components.
 * Type-only imports, so nothing server-only reaches the browser bundle.
 */
import type { WikiPage } from "./models/wiki";

/** One node of the page tree. Children are sorted by title. */
export interface WikiTreeNode {
  id: string;
  title: string;
  slug: string;
  children: WikiTreeNode[];
}

/** An ancestor link in the breadcrumb trail. */
export interface WikiCrumb {
  title: string;
  slug: string;
}

/** A flattened page reference for the "parent page" picker. */
export interface WikiPageOption {
  id: string;
  title: string;
  /** Nesting depth, used to indent the option label. */
  depth: number;
}

export interface WikiPageDetail {
  page: WikiPage;
  /** Ancestors, root first, excluding the page itself. */
  breadcrumbs: WikiCrumb[];
  authorName: string;
  updatedByName: string;
  /**
   * True when the URL used a retired slug. The route redirects to `page.slug`
   * so the canonical URL is what ends up in the address bar.
   */
  matchedAlias: boolean;
}
