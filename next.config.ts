import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // A stray lockfile above this project (~/package-lock.json) makes Next infer
  // the wrong workspace root. Pin it to this app so output file tracing (used
  // for the Vercel deployment bundle) stays correctly scoped.
  outputFileTracingRoot: path.resolve(__dirname),
};

export default nextConfig;
