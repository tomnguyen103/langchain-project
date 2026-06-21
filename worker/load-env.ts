import { neonConfig } from "@neondatabase/serverless";
import { config } from "dotenv";
import ws from "ws";

/**
 * Side-effect module: load local env BEFORE any module that reads it.
 *
 * ES module imports are hoisted and evaluated before top-level statements, so a
 * plain `config()` call in index.ts would run *after* `lib/env.ts` is already
 * evaluated. Importing this file first (a side-effect import) guarantees
 * `.env.local` is loaded before env validation runs. In production the host
 * provides env vars directly and the missing file is a harmless no-op.
 */
config({ path: ".env.local" });

/**
 * The worker uses the pooled WebSocket DB driver (see db/index.ts). Provide the
 * Node WebSocket implementation Neon's serverless Pool needs, and default the
 * driver to "pool" unless the host explicitly overrides it. This runs before
 * db/index.ts is imported, so `db` is constructed with the pooled client.
 */
neonConfig.webSocketConstructor = ws;
if (!process.env.DB_DRIVER) {
  process.env.DB_DRIVER = "pool";
}
