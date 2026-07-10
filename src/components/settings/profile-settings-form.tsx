"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import {
  changePasswordAction,
  updateProfileAction,
} from "@/lib/actions/profile";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { getInitials } from "@/lib/format";
import type { User } from "@/lib/models/user";

/** Minimum new-password length; mirrors `changePasswordSchema`. */
const MIN_PASSWORD_LENGTH = 8;

/**
 * The signed-in user's own profile: rename themselves and (outside LOCAL_MODE)
 * change their password. The avatar is initials-derived and not editable, so it
 * previews live as the name is typed.
 */
export function ProfileSettingsForm({
  user,
  showPassword,
}: {
  user: User;
  showPassword: boolean;
}) {
  return (
    <div className="space-y-5 rounded-lg border p-5">
      <ProfileSection user={user} />
      {showPassword ? (
        <>
          <Separator />
          <PasswordSection />
        </>
      ) : (
        <>
          <Separator />
          <p className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
            Password changes are disabled in local mode — there is no login.
          </p>
        </>
      )}
    </div>
  );
}

function ProfileSection({ user }: { user: User }) {
  const router = useRouter();
  const [name, setName] = useState(user.name);
  const [pending, startTransition] = useTransition();

  const trimmed = name.trim();
  const dirty = trimmed !== user.name;

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!trimmed || pending || !dirty) return;

    startTransition(async () => {
      const result = await updateProfileAction({ name: trimmed });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Profile updated");
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex items-center gap-3">
        <Avatar className="size-12">
          <AvatarFallback>{getInitials(trimmed || user.name)}</AvatarFallback>
        </Avatar>
        <div className="text-sm text-muted-foreground">
          Your avatar is drawn from your initials.
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="profile-name">Name</Label>
        <Input
          id="profile-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          disabled={pending}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="profile-email">Email</Label>
        <Input id="profile-email" value={user.email} disabled readOnly />
        <p className="text-xs text-muted-foreground">
          Your sign-in identity — not editable here.
        </p>
      </div>

      <Button type="submit" disabled={pending || !dirty || !trimmed}>
        {pending ? "Saving…" : "Save changes"}
      </Button>
    </form>
  );
}

function PasswordSection() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [reveal, setReveal] = useState(false);
  const [pending, startTransition] = useTransition();

  const mismatch = confirm.length > 0 && next !== confirm;
  const tooShort = next.length > 0 && next.length < MIN_PASSWORD_LENGTH;
  const sameAsCurrent = next.length > 0 && next === current;
  const canSubmit =
    Boolean(current) &&
    next.length >= MIN_PASSWORD_LENGTH &&
    next === confirm &&
    !sameAsCurrent &&
    !pending;

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;

    startTransition(async () => {
      const result = await changePasswordAction({
        currentPassword: current,
        newPassword: next,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Password changed");
      setCurrent("");
      setNext("");
      setConfirm("");
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Password</h3>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 text-xs text-muted-foreground"
          onClick={() => setReveal((v) => !v)}
        >
          {reveal ? (
            <EyeOff className="size-3.5" />
          ) : (
            <Eye className="size-3.5" />
          )}
          {reveal ? "Hide" : "Show"}
        </Button>
      </div>

      <div className="space-y-2">
        <Label htmlFor="current-password">Current password</Label>
        <Input
          id="current-password"
          type={reveal ? "text" : "password"}
          autoComplete="current-password"
          value={current}
          onChange={(event) => setCurrent(event.target.value)}
          disabled={pending}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="new-password">New password</Label>
        <Input
          id="new-password"
          type={reveal ? "text" : "password"}
          autoComplete="new-password"
          value={next}
          onChange={(event) => setNext(event.target.value)}
          disabled={pending}
          aria-invalid={tooShort || sameAsCurrent}
        />
        <p className="text-xs text-muted-foreground">
          At least {MIN_PASSWORD_LENGTH} characters.
        </p>
        {sameAsCurrent ? (
          <p className="text-xs text-destructive">
            Choose a password different from your current one.
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirm-password">Confirm new password</Label>
        <Input
          id="confirm-password"
          type={reveal ? "text" : "password"}
          autoComplete="new-password"
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
          disabled={pending}
          aria-invalid={mismatch}
        />
        {mismatch ? (
          <p className="text-xs text-destructive">Passwords don&apos;t match.</p>
        ) : null}
      </div>

      <Button type="submit" disabled={!canSubmit}>
        {pending ? "Changing…" : "Change password"}
      </Button>
    </form>
  );
}
