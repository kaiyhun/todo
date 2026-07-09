"use client";

import { createContext, useContext } from "react";
import { DEFAULT_TIMEZONE } from "@/lib/timezone";

/**
 * Supplies the workspace's timezone to Client Components.
 *
 * Server Components read it from `requireContext()`. Client Components can't, so
 * the app shell publishes it here. Passing it explicitly (rather than letting each
 * component read the ambient zone) is what keeps the server and browser renders
 * identical — an ambient `toLocaleDateString()` is a hydration mismatch waiting to
 * happen.
 */
const TimezoneContext = createContext<string>(DEFAULT_TIMEZONE);

export function TimezoneProvider({
  timezone,
  children,
}: {
  timezone: string;
  children: React.ReactNode;
}) {
  return (
    <TimezoneContext.Provider value={timezone}>
      {children}
    </TimezoneContext.Provider>
  );
}

/** The workspace's IANA timezone, e.g. `America/Vancouver`. */
export function useTimezone(): string {
  return useContext(TimezoneContext);
}
