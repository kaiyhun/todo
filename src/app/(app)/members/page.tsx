import type { Metadata } from "next";
import { Info } from "lucide-react";
import { requireContext } from "@/lib/session";
import { getMemberDirectory } from "@/lib/queries/members";
import { canManageMembers } from "@/lib/permissions";
import { isLocalMode } from "@/lib/auth/local-mode";
import { AddMemberForm } from "@/components/members/add-member-form";
import { MembersTable } from "@/components/members/members-table";

export const metadata: Metadata = { title: "Members" };

export default async function MembersPage() {
  const { user, workspace, role } = await requireContext();
  const members = await getMemberDirectory(workspace);
  const mayManage = canManageMembers(role);

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Members</h1>
        <p className="text-sm text-muted-foreground">
          Who can see and work in {workspace.name}. Roles control member
          management only — everyone can create, edit and delete content.
        </p>
      </header>

      {isLocalMode() ? (
        <p className="flex items-start gap-2 rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
          <Info className="mt-0.5 size-3.5 shrink-0" />
          <span>
            Authentication is disabled (<code>LOCAL_MODE</code>), so you act as the
            local user with owner permissions.
          </span>
        </p>
      ) : null}

      {mayManage ? (
        <AddMemberForm />
      ) : (
        <p className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
          Only the owner and admins can add or remove members.
        </p>
      )}

      <MembersTable
        rows={members}
        currentUserId={user.id}
        currentRole={role}
      />

      <p className="text-xs text-muted-foreground">
        {members.length} {members.length === 1 ? "member" : "members"}.
      </p>
    </div>
  );
}
