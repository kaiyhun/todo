import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { isLocalMode } from "@/lib/auth/local-mode";
import { getCurrentUser } from "@/lib/session";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage() {
  // Nobody needs to sign in when auth is disabled or already signed in.
  if (isLocalMode()) redirect("/dashboard");
  if (await getCurrentUser()) redirect("/dashboard");

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Welcome back</CardTitle>
        <CardDescription>Sign in to your Sprintboard workspace.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <LoginForm />
        <p className="text-center text-sm text-muted-foreground">
          No account?{" "}
          <Link
            href="/register"
            className="underline underline-offset-4 hover:text-foreground"
          >
            Create one
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
