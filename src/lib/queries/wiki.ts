/**
 * Wiki read models. Node.js runtime only (touches MongoDB).
 *
 * A workspace's wiki is small, so the tree is built in memory from a projected
 * list of every page rather than with a recursive `$graphLookup`.
 */
import "server-only";
import type { ObjectId } from "mongodb";
import { usersCollection, wikiPagesCollection } from "@/lib/db/collections";
import { toObjectId } from "@/lib/models/common";
import { buildSnippet, escapeRegex } from "@/lib/text";
import { MIN_QUERY_LENGTH, type WikiSearchHit } from "@/lib/wiki-search";
import { serializeWikiPage } from "@/lib/models/wiki";
import type {
  WikiCrumb,
  WikiPageDetail,
  WikiPageOption,
  WikiTreeNode,
} from "@/lib/wiki-types";

/** The minimum needed to build the tree and breadcrumbs — no `content`. */
interface PageStub {
  id: string;
  title: string;
  slug: string;
  parentId: string | null;
}

async function getPageStubs(workspaceId: string): Promise<PageStub[]> {
  const docs = await wikiPagesCollection()
    .find({ workspaceId: toObjectId(workspaceId) })
    .project<{
      _id: ObjectId;
      title: string;
      slug: string;
      parentId: ObjectId | null;
    }>({ title: 1, slug: 1, parentId: 1 })
    .sort({ title: 1 })
    .toArray();

  return docs.map((doc) => ({
    id: doc._id.toString(),
    title: doc.title,
    slug: doc.slug,
    parentId: doc.parentId ? doc.parentId.toString() : null,
  }));
}

/**
 * Assemble stubs into a forest. A page whose parent is missing is promoted to
 * the root rather than vanishing.
 */
function buildTree(stubs: PageStub[]): WikiTreeNode[] {
  const nodes = new Map<string, WikiTreeNode>(
    stubs.map((stub) => [
      stub.id,
      { id: stub.id, title: stub.title, slug: stub.slug, children: [] },
    ]),
  );

  const roots: WikiTreeNode[] = [];
  for (const stub of stubs) {
    const node = nodes.get(stub.id)!;
    const parent = stub.parentId ? nodes.get(stub.parentId) : undefined;
    if (parent) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

/** The whole page tree for the sidebar. */
export async function getWikiTree(workspaceId: string): Promise<WikiTreeNode[]> {
  return buildTree(await getPageStubs(workspaceId));
}

/**
 * Search a workspace's pages by title, content, slug and retired slugs.
 *
 * Matching runs against the **raw markdown** so that `.env.example` or a term
 * inside a code fence is findable; the snippet is built from a markdown-stripped
 * copy so the result list reads as prose.
 *
 * A regex scan (rather than a `$text` index) is the right trade-off at wiki scale:
 * it matches partial words — `onboard` finds `onboarding`, which `$text` would
 * miss because that's a prefix, not a word.
 */
export async function searchWikiPages(
  workspaceId: string,
  rawQuery: string,
): Promise<WikiSearchHit[]> {
  const query = rawQuery.trim();
  if (query.length < MIN_QUERY_LENGTH) return [];

  const pattern = { $regex: escapeRegex(query), $options: "i" };

  const docs = await wikiPagesCollection()
    .find({
      workspaceId: toObjectId(workspaceId),
      $or: [
        { title: pattern },
        { content: pattern },
        { slug: pattern },
        // A regex against an array field matches if any element matches.
        { slugAliases: pattern },
      ],
    })
    .project<{
      _id: ObjectId;
      title: string;
      slug: string;
      slugAliases: string[];
      content: string;
    }>({ title: 1, slug: 1, slugAliases: 1, content: 1 })
    .limit(50)
    .toArray();

  const needle = query.toLowerCase();

  return docs.map((doc) => {
    const matchedTitle = doc.title.toLowerCase().includes(needle);
    const matchedSlug =
      doc.slug.toLowerCase().includes(needle) ||
      (doc.slugAliases ?? []).some((alias) =>
        alias.toLowerCase().includes(needle),
      );
    const matchedContent = doc.content.toLowerCase().includes(needle);

    return {
      pageId: doc._id.toString(),
      matchedTitle,
      matchedSlug,
      // The title is already on screen; only excerpt when the body is why it hit.
      snippet:
        matchedContent && !matchedTitle ? buildSnippet(doc.content, query) : null,
    };
  });
}

/** How many pages sit directly under `pageId` — shown in the delete warning. */
export async function getWikiChildCount(
  workspaceId: string,
  pageId: string,
): Promise<number> {
  return wikiPagesCollection().countDocuments({
    workspaceId: toObjectId(workspaceId),
    parentId: toObjectId(pageId),
  });
}

/** The slug of the first top-level page, used to land `/wiki` somewhere useful. */
export async function getFirstWikiSlug(
  workspaceId: string,
): Promise<string | null> {
  const tree = await getWikiTree(workspaceId);
  return tree[0]?.slug ?? null;
}

/**
 * Flattened options for the "parent page" picker.
 *
 * `excludeId`'s own subtree is omitted — re-parenting a page under one of its own
 * descendants would create a cycle. (The action re-checks this server-side.)
 */
export async function getWikiPageOptions(
  workspaceId: string,
  excludeId?: string,
): Promise<WikiPageOption[]> {
  const tree = await getWikiTree(workspaceId);
  const options: WikiPageOption[] = [];

  const walk = (nodes: WikiTreeNode[], depth: number) => {
    for (const node of nodes) {
      if (node.id === excludeId) continue; // skips the node and its whole subtree
      options.push({ id: node.id, title: node.title, depth });
      walk(node.children, depth + 1);
    }
  };
  walk(tree, 0);

  return options;
}

/**
 * Resolve a page by its canonical slug **or** any retired slug.
 *
 * Returns `matchedAlias: true` in the latter case so the route can redirect to
 * the canonical URL instead of serving the same page from two addresses.
 */
export async function getWikiPageBySlug(
  workspaceId: string,
  slug: string,
): Promise<WikiPageDetail | null> {
  const workspaceObjectId = toObjectId(workspaceId);

  const doc = await wikiPagesCollection().findOne({
    workspaceId: workspaceObjectId,
    $or: [{ slug }, { slugAliases: slug }],
  });
  if (!doc) return null;

  const [stubs, author, updatedBy] = await Promise.all([
    getPageStubs(workspaceId),
    usersCollection().findOne({ _id: doc.authorId }),
    usersCollection().findOne({ _id: doc.updatedById }),
  ]);

  // Walk up the parent chain. The `seen` guard means a corrupted cycle degrades
  // to a short breadcrumb rather than hanging the request.
  const stubsById = new Map(stubs.map((stub) => [stub.id, stub]));
  const breadcrumbs: WikiCrumb[] = [];
  const seen = new Set<string>();

  let cursor = doc.parentId ? stubsById.get(doc.parentId.toString()) : undefined;
  while (cursor && !seen.has(cursor.id)) {
    seen.add(cursor.id);
    breadcrumbs.unshift({ title: cursor.title, slug: cursor.slug });
    cursor = cursor.parentId ? stubsById.get(cursor.parentId) : undefined;
  }

  return {
    page: serializeWikiPage(doc),
    breadcrumbs,
    authorName: author?.name ?? "Unknown",
    updatedByName: updatedBy?.name ?? "Unknown",
    matchedAlias: doc.slug !== slug,
  };
}
