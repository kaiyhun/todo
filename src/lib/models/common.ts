/**
 * Shared building blocks for every data model.
 *
 * Convention used throughout the models layer:
 *   • `XDoc`   — the shape as stored in MongoDB (uses `ObjectId`, `Date`).
 *   • `X`      — a plain, JSON-safe DTO (string ids, ISO date strings) that is
 *                safe to pass across the Server → Client Component boundary.
 *   • `serializeX(doc)` — maps a `XDoc` to an `X`.
 *
 * ObjectId and Date instances cannot be handed to Client Components directly, so
 * anything that crosses that boundary must be serialised first.
 */
import { z } from "zod";
import { ObjectId } from "mongodb";

/** Fields present on every persisted document. */
export interface BaseDoc {
  _id: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

/** Hex-string form of an ObjectId, as used in DTOs and URLs. */
export type Id = string;

/** Coerce a string or ObjectId into an ObjectId (throws on an invalid string). */
export function toObjectId(value: string | ObjectId): ObjectId {
  return typeof value === "string" ? new ObjectId(value) : value;
}

/** Whether a string is a well-formed ObjectId — cheap guard for route params. */
export function isValidObjectId(value: string): boolean {
  return ObjectId.isValid(value);
}

/** Serialise a nullable Date to an ISO string (or null). */
export function serializeDate(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

/** Zod validator for an id arriving from a form, URL or client payload. */
export const objectIdSchema = z
  .string()
  .regex(/^[a-f0-9]{24}$/i, "Invalid id");

// Status/priority enums live in `./enums` — a dependency-free module, so Client
// Components can import them without pulling in zod or the Mongo driver.
