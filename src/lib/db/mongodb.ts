/**
 * MongoDB connection management.
 *
 * A single `MongoClient` is shared across the whole application. The driver
 * connects lazily on first operation and internally manages a connection pool,
 * so re-using one client is both correct and optimal for serverless (Vercel),
 * where many function invocations share a warm process.
 *
 * In development the client is cached on `globalThis` so that Hot Module
 * Reloading does not open a fresh pool on every edit — which would quickly
 * exhaust the small connection limit on an Atlas free (M0) cluster.
 *
 * See: https://www.mongodb.com/docs/drivers/node/current/ (auto-connect + pooling)
 */
import { MongoClient, type Db } from "mongodb";
import { env } from "@/env";

// Stash the client on the global object so HMR reloads reuse the same pool.
const globalForMongo = globalThis as unknown as {
  _mongoClient?: MongoClient;
};

const client =
  globalForMongo._mongoClient ??
  new MongoClient(env.MONGODB_URI, {
    // Fail fast (10s) if the cluster is unreachable instead of hanging a request.
    serverSelectionTimeoutMS: 10_000,
    appName: "todo-app",
  });

// Only cache outside production; in prod each serverless instance keeps its own.
if (env.NODE_ENV !== "production") {
  globalForMongo._mongoClient = client;
}

/** The shared MongoClient. Prefer `getDb()` / `getCollection()` in app code. */
export const mongoClient = client;

/** Returns the configured application database. */
export function getDb(): Db {
  return client.db(env.MONGODB_DB);
}
