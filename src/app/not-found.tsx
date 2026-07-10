import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Not found" };

/**
 * Root 404 for URLs that match no route. Renders inside the root layout (no app
 * shell); in-app `notFound()` calls use `(app)/not-found.tsx` instead.
 */
export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
      <p className="text-5xl font-bold tracking-tight text-muted-foreground">404</p>
      <div className="space-y-1">
        <h1 className="text-lg font-semibold">Page not found</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          That page doesn&apos;t exist or may have moved.
        </p>
      </div>
      <Link
        href="/dashboard"
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
      >
        Back to dashboard
      </Link>
    </main>
  );
}
