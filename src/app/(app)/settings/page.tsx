import type { Metadata } from "next";
import { Settings } from "lucide-react";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <ComingSoon
      icon={Settings}
      title="Settings"
      milestone="M5"
      description="Workspace name, sprint defaults and profile settings."
    />
  );
}
