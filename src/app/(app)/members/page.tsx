import type { Metadata } from "next";
import { Users } from "lucide-react";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Members" };

export default function MembersPage() {
  return (
    <ComingSoon
      icon={Users}
      title="Members"
      milestone="M3"
      description="Invite teammates, manage per-workspace roles, and assign members to tasks."
    />
  );
}
