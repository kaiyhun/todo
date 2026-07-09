"use client";

import { useMemo, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { listTimeZones } from "@/lib/timezone";

/**
 * Searchable picker over the runtime's ~418 IANA zones.
 *
 * The list only mounts when the popover opens, so the closed trigger is all that
 * server-renders — no 418-item hydration cost, and no ambient-timezone read.
 */
export function TimezoneCombobox({
  value,
  onChange,
  disabled = false,
  id,
}: {
  value: string;
  onChange: (timezone: string) => void;
  disabled?: boolean;
  id?: string;
}) {
  const [open, setOpen] = useState(false);
  const zones = useMemo(() => listTimeZones(), []);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="w-full justify-between font-normal"
        >
          {value || "Select a timezone"}
          <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search timezones…" />
          <CommandList>
            <CommandEmpty>No timezone found.</CommandEmpty>
            <CommandGroup>
              {zones.map((zone) => (
                <CommandItem
                  key={zone}
                  value={zone}
                  onSelect={(selected) => {
                    onChange(selected);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "size-4",
                      zone === value ? "opacity-100" : "opacity-0",
                    )}
                  />
                  {zone}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
