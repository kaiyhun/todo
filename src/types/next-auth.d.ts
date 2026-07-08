/**
 * Module augmentation so TypeScript knows about the custom fields we place on
 * the session/JWT (`id` and `role`). Without this, `session.user.id` would be a
 * type error.
 */
import type { DefaultSession } from "next-auth";
import type { UserRole } from "@/lib/models/user";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: UserRole;
    } & DefaultSession["user"];
  }

  /** The object returned by `authorize` / stored as the provider user. */
  interface User {
    role: UserRole;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: UserRole;
  }
}
