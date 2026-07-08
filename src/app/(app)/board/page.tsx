import type { Metadata } from "next";
import { Columns3 } from "lucide-react";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Board" };

export default function BoardPage() {
  return (
    <ComingSoon
      icon={Columns3}
      title="Sprint Board"
      milestone="M1"
      description="A drag-and-drop Kanban board with columns for each status, sprint switching and inline task creation."
    />
  );
}
