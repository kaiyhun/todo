import type { Metadata } from "next";
import { BookOpen } from "lucide-react";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Wiki" };

export default function WikiPage() {
  return (
    <ComingSoon
      icon={BookOpen}
      title="Team Wiki"
      milestone="M4"
      description="Nested Markdown pages for team documentation, with editing, a page tree and full-text search."
    />
  );
}
