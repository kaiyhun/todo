"use server";

/**
 * Server Actions for wiki pages.
 *
 * Permissions are loose (see `lib/permissions.ts`): any member may create, edit
 * and delete pages. Every query is scoped by `workspaceId`.
 */
import { ObjectId } from "mongodb";
import { revalidatePath } from "next/cache";
import { requireContext } from "@/lib/session";
import { searchWikiPages } from "@/lib/queries/wiki";
import type { WikiSearchHit } from "@/lib/wiki-search";
import { wikiPagesCollection } from "@/lib/db/collections";
import { isValidObjectId, slugify, toObjectId } from "@/lib/models/common";
import {
  createWikiPageSchema,
  updateWikiPageSchema,
} from "@/lib/models/wiki";
import type { ActionResultWith } from "./types";

/** The tree lives in the wiki layout, so revalidate the whole segment. */
function revalidateWiki(): void {
  revalidatePath("/wiki", "layout");
}

/**
 * A slug derived from `title` that no *other* page in the workspace already uses
 * as its canonical slug. Collisions get a numeric suffix: `notes`, `notes-2`, …
 */
async function allocateSlug(
  workspaceId: ObjectId,
  title: string,
  excludeId?: ObjectId,
): Promise<string> {
  const base = slugify(title) || "page";
  let candidate = base;
  let suffix = 1;

  for (;;) {
    const clash = await wikiPagesCollection().findOne({
      workspaceId,
      slug: candidate,
      ...(excludeId ? { _id: { $ne: excludeId } } : {}),
    });
    if (!clash) return candidate;
    suffix += 1;
    candidate = `${base}-${suffix}`;
  }
}

/**
 * Would nesting `pageId` under `newParentId` create a cycle? Walks up from the
 * proposed parent looking for the page itself. The `seen` guard means an already
 * corrupted chain terminates instead of looping forever.
 */
async function wouldCreateCycle(
  workspaceId: ObjectId,
  pageId: ObjectId,
  newParentId: ObjectId,
): Promise<boolean> {
  let cursor: ObjectId | null = newParentId;
  const seen = new Set<string>();

  while (cursor) {
    if (cursor.equals(pageId)) return true;

    const key = cursor.toString();
    if (seen.has(key)) return true;
    seen.add(key);

    const parent: { parentId: ObjectId | null } | null =
      await wikiPagesCollection().findOne(
        { _id: cursor, workspaceId },
        { projection: { parentId: 1 } },
      );
    if (!parent) return false;
    cursor = parent.parentId;
  }
  return false;
}

/** Verify a proposed parent exists in this workspace. */
async function parentExists(
  workspaceId: ObjectId,
  parentId: ObjectId,
): Promise<boolean> {
  return Boolean(
    await wikiPagesCollection().findOne(
      { _id: parentId, workspaceId },
      { projection: { _id: 1 } },
    ),
  );
}

/**
 * Search the current workspace's wiki. A read, exposed as an action because the
 * page tree lives in `wiki/layout.tsx` and Next.js layouts never receive
 * `searchParams` — so the sidebar can't be driven from the URL the way the board
 * and tasks filters are.
 *
 * Server Actions from one client are serialised, so responses arrive in request
 * order; the sidebar still discards any result whose query is no longer current.
 */
export async function searchWikiPagesAction(
  query: string,
): Promise<ActionResultWith<WikiSearchHit[]>> {
  const { workspace } = await requireContext();
  if (typeof query !== "string") return { ok: false, error: "Invalid query" };

  return { ok: true, data: await searchWikiPages(workspace.id, query) };
}

export async function createWikiPageAction(
  input: unknown,
): Promise<ActionResultWith<{ id: string; slug: string }>> {
  const { user, workspace } = await requireContext();

  const parsed = createWikiPageSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid page" };
  }
  const { title, content, parentId } = parsed.data;

  const workspaceObjectId = toObjectId(workspace.id);

  if (parentId) {
    const parentObjectId = toObjectId(parentId);
    if (!(await parentExists(workspaceObjectId, parentObjectId))) {
      return { ok: false, error: "Parent page not found" };
    }
  }

  const now = new Date();
  const _id = new ObjectId();
  const slug = await allocateSlug(workspaceObjectId, title);

  await wikiPagesCollection().insertOne({
    _id,
    workspaceId: workspaceObjectId,
    title,
    slug,
    slugAliases: [],
    content,
    parentId: parentId ? toObjectId(parentId) : null,
    authorId: toObjectId(user.id),
    updatedById: toObjectId(user.id),
    createdAt: now,
    updatedAt: now,
  });

  revalidateWiki();
  return { ok: true, data: { id: _id.toString(), slug } };
}

/**
 * Edit a page.
 *
 * Renaming regenerates the slug and retires the old one into `slugAliases`, so
 * existing links keep resolving. Returns the (possibly new) canonical slug so the
 * caller can navigate to it.
 */
export async function updateWikiPageAction(
  pageId: string,
  input: unknown,
): Promise<ActionResultWith<{ slug: string }>> {
  const { user, workspace } = await requireContext();
  if (!isValidObjectId(pageId)) return { ok: false, error: "Invalid page id" };

  const parsed = updateWikiPageSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid page" };
  }
  const patch = parsed.data;

  const workspaceObjectId = toObjectId(workspace.id);
  const pageObjectId = toObjectId(pageId);

  const existing = await wikiPagesCollection().findOne({
    _id: pageObjectId,
    workspaceId: workspaceObjectId,
  });
  if (!existing) return { ok: false, error: "Page not found" };

  const set: Record<string, unknown> = {
    updatedAt: new Date(),
    updatedById: toObjectId(user.id),
  };
  if (patch.content !== undefined) set.content = patch.content;

  // ---- Re-parenting -------------------------------------------------------
  if (patch.parentId !== undefined) {
    if (patch.parentId === null) {
      set.parentId = null;
    } else {
      const parentObjectId = toObjectId(patch.parentId);
      if (!(await parentExists(workspaceObjectId, parentObjectId))) {
        return { ok: false, error: "Parent page not found" };
      }
      if (await wouldCreateCycle(workspaceObjectId, pageObjectId, parentObjectId)) {
        return { ok: false, error: "A page can't be nested inside itself" };
      }
      set.parentId = parentObjectId;
    }
  }

  // ---- Rename → new slug, old slug retired as an alias ---------------------
  let canonicalSlug = existing.slug;

  if (patch.title !== undefined && patch.title !== existing.title) {
    set.title = patch.title;
    canonicalSlug = await allocateSlug(
      workspaceObjectId,
      patch.title,
      pageObjectId,
    );

    if (canonicalSlug !== existing.slug) {
      const previousAliases = existing.slugAliases ?? [];
      // Compute the array outright: `$addToSet` and `$pull` on the same field in
      // one update is a Mongo conflict error.
      set.slug = canonicalSlug;
      set.slugAliases = Array.from(
        new Set([...previousAliases, existing.slug]),
      ).filter((alias) => alias !== canonicalSlug);

      // No other page may keep this slug as an alias, or the `$or` lookup in
      // `getWikiPageBySlug` becomes ambiguous. The canonical slug wins.
      await wikiPagesCollection().updateMany(
        {
          workspaceId: workspaceObjectId,
          _id: { $ne: pageObjectId },
          slugAliases: canonicalSlug,
        },
        { $pull: { slugAliases: canonicalSlug } },
      );
    }
  }

  await wikiPagesCollection().updateOne(
    { _id: pageObjectId, workspaceId: workspaceObjectId },
    { $set: set },
  );

  revalidateWiki();
  return { ok: true, data: { slug: canonicalSlug } };
}

/**
 * Delete a page and lift its children up to the deleted page's parent, so no
 * writing is destroyed by accident. Returns where to navigate afterwards.
 */
export async function deleteWikiPageAction(
  pageId: string,
): Promise<ActionResultWith<{ parentSlug: string | null }>> {
  const { workspace } = await requireContext();
  if (!isValidObjectId(pageId)) return { ok: false, error: "Invalid page id" };

  const workspaceObjectId = toObjectId(workspace.id);
  const pageObjectId = toObjectId(pageId);

  const page = await wikiPagesCollection().findOne({
    _id: pageObjectId,
    workspaceId: workspaceObjectId,
  });
  if (!page) return { ok: false, error: "Page not found" };

  // Children are adopted by their grandparent (or become top-level).
  await wikiPagesCollection().updateMany(
    { workspaceId: workspaceObjectId, parentId: pageObjectId },
    { $set: { parentId: page.parentId, updatedAt: new Date() } },
  );

  await wikiPagesCollection().deleteOne({
    _id: pageObjectId,
    workspaceId: workspaceObjectId,
  });

  let parentSlug: string | null = null;
  if (page.parentId) {
    const parent = await wikiPagesCollection().findOne(
      { _id: page.parentId, workspaceId: workspaceObjectId },
      { projection: { slug: 1 } },
    );
    parentSlug = parent?.slug ?? null;
  }

  revalidateWiki();
  return { ok: true, data: { parentSlug } };
}
