"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Toggles the `?mine=1` board filter, which *dims* cards not assigned to you.
 *
 * Deliberately not a hard filter: removing cards would make a drag submit an
 * incomplete ordering for its cell (silently reordering other people's cards) and
 * would make each epic's rollup describe only a subset of its tasks.
 */
export function MineFilterToggle({ active }: { active: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function toggle() {
    const params = new URLSearchParams(searchParams.toString());
    if (active) {
      params.delete("mine");
    } else {
      params.set("mine", "1");
    }
    const search = params.toString();
    router.replace(search ? `${pathname}?${search}` : pathname, { scroll: false });
  }

  return (
    <Button
      type="button"
      variant={active ? "default" : "outline"}
      size="sm"
      onClick={toggle}
      aria-pressed={active}
      className="gap-1.5"
    >
      <UserCheck className="size-4" />
      Assigned to me
    </Button>
  );
}
