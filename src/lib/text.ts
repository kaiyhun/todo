/**
 * Pure text helpers shared by search on both the server and the client.
 * No imports, so this is safe in either bundle.
 */

/**
 * Escape a user-supplied string before embedding it in a regular expression —
 * whether for a Mongo `$regex` or a client-side highlight. Without this, a query
 * of `.*` matches everything.
 */
export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Reduce Markdown source to readable prose for search snippets.
 *
 * Fence *markers* are removed but the code inside them is kept, so searching for
 * something like `npm run seed` still produces a useful excerpt. This is only ever
 * used for display — matching itself runs against the raw source.
 */
export function stripMarkdown(markdown: string): string {
  return markdown
    .replace(/^\s*```.*$/gm, " ") // fence markers, keeping the code between them
    .replace(/`([^`]*)`/g, "$1") // inline code
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ") // images
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1") // links → their text
    .replace(/^\s{0,3}#{1,6}\s+/gm, "") // headings
    .replace(/^\s{0,3}>\s?/gm, "") // blockquotes
    .replace(/^\s*[-*+]\s+(\[[ xX]\]\s+)?/gm, "") // bullets and task boxes
    .replace(/^\s*\d+\.\s+/gm, "") // ordered lists
    .replace(/^\s*\|?[-:|\s]+\|?\s*$/gm, " ") // table separator rows
    .replace(/\|/g, " ") // remaining table pipes
    // Emphasis: unwrap *paired* markers only. A blanket strip of `*` and `_`
    // would mangle code that survives the fences above — `doc._id` → `doc.id`,
    // `snake_case` → `snakecase`. Underscore emphasis additionally requires a
    // whitespace boundary, which is what markdown itself demands.
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/~~([^~]+)~~/g, "$1")
    .replace(/(^|\s)__([^_]+)__(?=\s|$)/g, "$1$2")
    .replace(/(^|\s)_([^_]+)_(?=\s|$)/g, "$1$2")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * A one-line excerpt of `content` centred on the first occurrence of `query`.
 * Falls back to the opening words when the term only appears in markup that
 * `stripMarkdown` removed. Returns `null` for an empty page.
 */
export function buildSnippet(
  content: string,
  query: string,
  radius = 45,
): string | null {
  const text = stripMarkdown(content);
  if (!text) return null;

  const index = text.toLowerCase().indexOf(query.toLowerCase());
  if (index === -1) {
    return text.length > 100 ? `${text.slice(0, 100).trim()}…` : text;
  }

  const start = Math.max(0, index - radius);
  const end = Math.min(text.length, index + query.length + radius);

  return [
    start > 0 ? "…" : "",
    text.slice(start, end).trim(),
    end < text.length ? "…" : "",
  ].join("");
}
