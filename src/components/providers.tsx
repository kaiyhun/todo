"use client";

/**
 * Client-side context providers mounted once at the app root:
 *   • next-themes  — light/dark/system theming via a class on <html>.
 *   • TooltipProvider — required by shadcn's Tooltip primitive.
 */
import { ThemeProvider } from "next-themes";
import { TooltipProvider } from "@/components/ui/tooltip";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <TooltipProvider delayDuration={200}>{children}</TooltipProvider>
    </ThemeProvider>
  );
}
