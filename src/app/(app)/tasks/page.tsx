import type { Metadata } from "next";
import { ListTodo } from "lucide-react";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Tasks" };

export default function TasksPage() {
  return (
    <ComingSoon
      icon={ListTodo}
      title="Tasks"
      milestone="M2"
      description="A filterable list of every task with search, priority and assignee filters, plus a full task detail view."
    />
  );
}
