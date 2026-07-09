"use client";

import { useState, useTransition } from "react";
import { UserPlus } from "lucide-react";
import { toast } from "sonner";
import { addMemberAction } from "@/lib/actions/members";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Adds an already-registered user to the workspace by email.
 *
 * There is no mail provider, so there is nothing to send: the teammate signs up
 * at /register themselves, then an owner/admin adds them here.
 */
export function AddMemberForm() {
  const [email, setEmail] = useState("");
  const [pending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = email.trim();
    if (!trimmed || pending) return;

    startTransition(async () => {
      const result = await addMemberAction({ email: trimmed });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Member added");
      setEmail("");
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-wrap items-end gap-2 rounded-lg border p-4"
    >
      <div className="flex-1 space-y-2 min-w-[240px]">
        <Label htmlFor="member-email">Add a teammate</Label>
        <Input
          id="member-email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="teammate@example.com"
          disabled={pending}
        />
        <p className="text-xs text-muted-foreground">
          They need an account first — ask them to sign up, then add them here.
        </p>
      </div>
      <Button type="submit" disabled={pending || !email.trim()} className="gap-1.5">
        <UserPlus className="size-4" />
        {pending ? "Adding…" : "Add member"}
      </Button>
    </form>
  );
}
