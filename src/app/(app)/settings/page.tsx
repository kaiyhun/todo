import type { Metadata } from "next";
import { requireContext } from "@/lib/session";
import { isLocalMode } from "@/lib/auth/local-mode";
import { canManageMembers } from "@/lib/permissions";
import { timeZoneAbbreviation } from "@/lib/timezone";
import { formatDateTime } from "@/lib/format";
import { WorkspaceSettingsForm } from "@/components/settings/workspace-settings-form";
import { ProfileSettingsForm } from "@/components/settings/profile-settings-form";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const { user, workspace, role } = await requireContext();

  // Computed here and passed down: a Client Component deriving these from
  // `new Date()` would render differently on the server than on hydration.
  const abbreviation = timeZoneAbbreviation(workspace.timezone);
  const sample = formatDateTime(new Date().toISOString(), workspace.timezone);

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Workspace-wide settings for {workspace.name}.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Workspace</h2>
        <WorkspaceSettingsForm
          workspace={workspace}
          canManage={canManageMembers(role)}
          abbreviation={abbreviation}
          sample={sample}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Profile</h2>
        <ProfileSettingsForm user={user} showPassword={!isLocalMode()} />
      </section>
    </div>
  );
}
