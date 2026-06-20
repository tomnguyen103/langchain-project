import { config } from "dotenv";

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
