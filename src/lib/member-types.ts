/**
 * Types shared by the Members Server Component and its Client Components.
 * Type-only imports, so nothing server-only reaches the browser bundle.
 */
import type { WorkspaceRole } from "./models/workspace";

/** One row of the members table: the user joined with their workspace membership. */
export interface MemberRow {
  id: string;
  name: string;
  email: string;
  image?: string;
  role: WorkspaceRole;
  /** ISO string. */
  joinedAt: string;
}
