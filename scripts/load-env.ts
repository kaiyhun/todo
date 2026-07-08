/**
 * Side-effect module: loads `.env.local` into `process.env` before any app
 * module (which validates env at import time) is evaluated.
 *
 * It must be the FIRST import in a script so its top-level code runs before the
 * db/env modules that depend on the variables. Uses Node's built-in env-file
 * loader (Node ≥ 20.12 / 22), so no dotenv dependency is required.
 */
import process from "node:process";

try {
  process.loadEnvFile(".env.local");
} catch {
  // No .env.local present — fall back to whatever is already in the environment
  // (e.g. variables exported in the shell or provided by the host).
}
