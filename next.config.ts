import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // A stray lockfile above this project (~/package-lock.json) makes Next infer
  // the wrong workspace root. Pin it to this app so output file tracing (used
  // for the Vercel deployment bundle) stays correctly scoped.
  outputFileTracingRoot: path.resolve(__dirname),

  webpack: (config) => {
    // Tooling scratch dirs must not trigger Fast Refresh. In particular the
    // Playwright MCP writes browser console logs into `.playwright-mcp/` on
    // every message, which otherwise creates a rebuild → reload → log loop.
    config.watchOptions = {
      ...config.watchOptions,
      ignored: [
        "**/.git/**",
        "**/node_modules/**",
        "**/.next/**",
        "**/.playwright-mcp/**",
      ],
    };
    return config;
  },
};

export default nextConfig;
