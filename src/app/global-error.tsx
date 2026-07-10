"use client";

import { useEffect } from "react";
// This boundary replaces the whole document (including the root layout), so it
// must pull global styles in itself — nothing above it does.
import "./globals.css";

/**
 * Last-resort error boundary for failures thrown in the **root layout** — the one
 * place `(app)/error.tsx` cannot reach. Because it stands in for the root layout,
 * it renders its own `<html>`/`<body>`.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
        <h1 className="text-lg font-semibold">Something went wrong</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          A critical error stopped the app from loading. Try again, or reload the page.
        </p>
        {error.digest ? (
          <p className="font-mono text-xs text-muted-foreground">
            digest: {error.digest}
          </p>
        ) : null}
        <button
          type="button"
          onClick={reset}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Try again
        </button>
      </body>
    </html>
  );
}
