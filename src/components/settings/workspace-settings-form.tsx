"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { updateWorkspaceAction } from "@/lib/actions/workspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TimezoneCombobox } from "./timezone-combobox";
import type { Workspace } from "@/lib/models/workspace";

/**
 * Workspace settings.
 *
 * `abbreviation` and `sample` are computed on the server and passed in, rather
 * than derived here from `new Date()` — a value that differs between the server
 * render and hydration would be a mismatch.
 */
export function WorkspaceSettingsForm({
  workspace,
  canManage,
  abbreviation,
  sample,
}: {
  workspace: Workspace;
  canManage: boolean;
  abbreviation: string;
  sample: string;
}) {
  const router = useRouter();
  const [name, setName] = useState(workspace.name);
  const [timezone, setTimezone] = useState(workspace.timezone);
  const [pending, startTransition] = useTransition();

  const dirty = name.trim() !== workspace.name || timezone !== workspace.timezone;

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim() || pending || !dirty) return;

    startTransition(async () => {
      const result = await updateWorkspaceAction({
        name: name.trim(),
        timezone,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Workspace updated");
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 rounded-lg border p-5">
      <div className="space-y-2">
        <Label htmlFor="workspace-name">Workspace name</Label>
        <Input
          id="workspace-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          disabled={!canManage || pending}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="workspace-slug">Slug</Label>
        <Input id="workspace-slug" value={workspace.slug} disabled readOnly />
        <p className="text-xs text-muted-foreground">
          Not editable — nothing links to it yet.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="workspace-timezone">Project timezone</Label>
        <TimezoneCombobox
          id="workspace-timezone"
          value={timezone}
          onChange={setTimezone}
          disabled={!canManage || pending}
        />
        <p className="text-xs text-muted-foreground">
          The team&apos;s shared clock. Every date is stored in UTC and displayed
          here{abbreviation ? ` (currently ${abbreviation})` : ""}. A due date of{" "}
          <strong>Jul 20</strong> means the end of the 20th in this zone.
        </p>
        {timezone !== workspace.timezone ? (
          <p className="text-xs text-muted-foreground">
            After saving, existing timestamps re-render in the new zone — the same
            moments, on a different clock.
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Timestamps look like: <span className="font-medium">{sample}</span>
          </p>
        )}
      </div>

      {canManage ? (
        <Button type="submit" disabled={pending || !dirty || !name.trim()}>
          {pending ? "Saving…" : "Save changes"}
        </Button>
      ) : (
        <p className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
          Only the owner and admins can change workspace settings.
        </p>
      )}
    </form>
  );
}
