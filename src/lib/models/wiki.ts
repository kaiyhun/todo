/**
 * Wiki page model.
 *
 * Pages hold Markdown source and nest via `parentId` to form a documentation
 * tree. A page is addressed by a slug that is unique within its workspace.
 *
 * Renaming a page regenerates its slug and pushes the previous one onto
 * `slugAliases`, so old links keep resolving (the route then redirects to the
 * canonical URL). Aliases are therefore part of the addressing scheme, not
 * decoration — see `getWikiPageBySlug`.
 */
import { z } from "zod";
import type { ObjectId } from "mongodb";
import { objectIdSchema, type BaseDoc } from "./common";

/** A wiki page as stored in the `wikiPages` collection. */
export interface WikiPageDoc extends BaseDoc {
  workspaceId: ObjectId;
  title: string;
  /** Canonical slug. Unique within a workspace. */
  slug: string;
  /**
   * Previously-used slugs that still resolve to this page. Never contains the
   * canonical `slug`, and never collides with another page's canonical slug.
   */
  slugAliases: string[];
  /** Markdown source. Raw HTML is not rendered, so this is not an XSS vector. */
  content: string;
  /** Parent page for nesting, or `null` for a top-level page. */
  parentId: ObjectId | null;
  authorId: ObjectId;
  updatedById: ObjectId;
}

/** JSON-safe wiki page DTO. */
export interface WikiPage {
  id: string;
  workspaceId: string;
  title: string;
  slug: string;
  slugAliases: string[];
  content: string;
  parentId: string | null;
  authorId: string;
  updatedById: string;
  createdAt: string;
  updatedAt: string;
}

export function serializeWikiPage(doc: WikiPageDoc): WikiPage {
  return {
    id: doc._id.toString(),
    workspaceId: doc.workspaceId.toString(),
    title: doc.title,
    slug: doc.slug,
    // Tolerate documents written before `slugAliases` existed.
    slugAliases: doc.slugAliases ?? [],
    content: doc.content,
    parentId: doc.parentId ? doc.parentId.toString() : null,
    authorId: doc.authorId.toString(),
    updatedById: doc.updatedById.toString(),
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

/** A new page starts empty, optionally nested under a parent. */
export const createWikiPageSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  content: z.string().max(100_000).default(""),
  parentId: objectIdSchema.nullable().optional(),
});
export type CreateWikiPageInput = z.infer<typeof createWikiPageSchema>;

/**
 * Editing a page. Absent means "leave unchanged".
 *
 * `parentId` is three-valued: `undefined` leaves the page where it is, `null`
 * moves it to the top level, and an id nests it under that page.
 */
export const updateWikiPageSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200).optional(),
  content: z.string().max(100_000).optional(),
  parentId: objectIdSchema.nullable().optional(),
});
export type UpdateWikiPageInput = z.infer<typeof updateWikiPageSchema>;
