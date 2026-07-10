import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { cn } from "@/lib/utils";

const markdownComponents: Components = {
  // GFM task-list items (`- [x]`) render as disabled, unlabeled checkboxes.
  // Give them an accessible name so screen readers announce their state.
  input({ node, ...props }) {
    void node;
    if (props.type === "checkbox") {
      return (
        <input
          {...props}
          aria-label={props.checked ? "Completed task" : "Incomplete task"}
        />
      );
    }
    return <input {...props} />;
  },
};

/**
 * Renders Markdown.
 *
 * Deliberately has no `"use client"`: `react-markdown` uses no hooks, so the wiki
 * *view* page renders it in a Server Component and ships no JavaScript for it. The
 * editor's live preview imports the same component, which pulls it into the client
 * bundle for that route only.
 *
 * Security: `rehype-raw` is **not** installed, so raw HTML inside markdown is
 * escaped rather than rendered — there is no `dangerouslySetInnerHTML` anywhere in
 * this path. `react-markdown` additionally neutralises `javascript:` URLs. Adding
 * raw-HTML support would require an explicit sanitizer with an allow-list.
 */
export function Markdown({
  content,
  className,
}: {
  content: string;
  className?: string;
}) {
  return (
    <div className={cn("prose prose-sm max-w-none dark:prose-invert", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        // `ignoreMissing` keeps an unknown ```lang from throwing at render time.
        rehypePlugins={[[rehypeHighlight, { ignoreMissing: true, detect: true }]]}
        components={markdownComponents}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
