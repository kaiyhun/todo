/**
 * Wiki page model.
 *
 * Wiki pages hold Markdown content and can be nested via `parentId` to form a
 * simple documentation tree. Pages are addressed by a per-workspace unique slug.
 */
import { z } from "zod";
import type { ObjectId } from "mongodb";
import { objectIdSchema, type BaseDoc } from "./common";

/** A wiki page as stored in the `wikiPages` collection. */
export interface WikiPageDoc extends BaseDoc {
  workspaceId: ObjectId;
  title: string;
  /** Unique within a workspace. */
  slug: string;
  /** Markdown source. */
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
    content: doc.content,
    parentId: doc.parentId ? doc.parentId.toString() : null,
    authorId: doc.authorId.toString(),
    updatedById: doc.updatedById.toString(),
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export const createWikiPageSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  content: z.string().max(100_000).default(""),
  parentId: objectIdSchema.nullable().optional(),
});
export type CreateWikiPageInput = z.infer<typeof createWikiPageSchema>;

export const updateWikiPageSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  content: z.string().max(100_000).optional(),
  parentId: objectIdSchema.nullable().optional(),
});
export type UpdateWikiPageInput = z.infer<typeof updateWikiPageSchema>;
