import { Pool, neon } from "@neondatabase/serverless";
import type { BatchItem, BatchResponse } from "drizzle-orm/batch";
import { drizzle as drizzleHttp, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import {
  drizzle as drizzleServerless,
  type NeonDatabase,
} from "drizzle-orm/neon-serverless";
import { drizzle as drizzleNodePostgres } from "drizzle-orm/node-postgres";
import { Pool as PgPool } from "pg";

import { env } from "@/lib/env";
import * as schema from "./schema";

/**
 * One shared `db` type for the whole codebase. Two drivers back it:
 *
 * - **App (default):** Neon's HTTP driver — stateless and serverless-friendly,
 *   one HTTPS round-trip per query. Correct for Vercel (no long-lived sockets).
 * - **Worker (`DB_DRIVER=pool`):** a pooled WebSocket driver. The always-on
 *   BullMQ worker issues many sequential queries per job (e.g. comment-poll:
 *   watermark + ingest + update per comment); a persistent connection avoids
 *   paying an HTTPS handshake on every one.
 * - **CI/local integration (`DB_DRIVER=node-postgres`):** a local Postgres
 *   driver for throwaway databases that cannot be reached through Neon.
 *
 * Repos import `db` and are driver-agnostic — they use only the shared query
 * builder. The one cross-driver wrinkle (atomic multi-statement writes) is
 * funneled through `runAtomicWrite` below.
 */
type AppDatabase = NeonHttpDatabase<typeof schema>;

const usesPool = env.DB_DRIVER === "pool";
const usesNodePostgres = env.DB_DRIVER === "node-postgres";

let pool: Pool | undefined;
let pgPool: PgPool | undefined;

function createDb(): AppDatabase {
  if (usesNodePostgres) {
    pgPool = new PgPool({ connectionString: env.DATABASE_URL });
    return drizzleNodePostgres(pgPool, { schema }) as unknown as AppDatabase;
  }

  if (usesPool) {
    // The WebSocket constructor (Node) is provided by the worker entry
    // (worker/load-env.ts) before this runs; the app never reaches this branch.
    pool = new Pool({ connectionString: env.DATABASE_URL });
    // Typed as the HTTP database so `db` has a single type. Safe because the
    // pooled client exposes the same query builder, and the only HTTP-only API
    // (.batch) is never called on it — runAtomicWrite uses a transaction here.
    return drizzleServerless(pool, { schema }) as unknown as AppDatabase;
  }
  const sql = neon(env.DATABASE_URL);
  return drizzleHttp(sql, { schema });
}

export const db = createDb();

export type Database = typeof db;
export { schema };

/**
 * Run a set of **independent** write statements atomically on either driver:
 * - HTTP driver: a single `.batch()` round-trip.
 * - Pooled driver: an interactive transaction (HTTP has no transactions; the
 *   pool has no `.batch()` — this bridges them).
 *
 * Statements must not depend on each other's results (pre-generate ids to link
 * rows). `build` receives the executor so the pooled path can bind statements
 * to the transaction rather than the auto-commit connection.
 */
export async function runAtomicWrite<
  T extends readonly [BatchItem<"pg">, ...BatchItem<"pg">[]],
>(build: (exec: AppDatabase) => T): Promise<BatchResponse<T>> {
  if (usesPool || usesNodePostgres) {
    return (
      db as unknown as Pick<NeonDatabase<typeof schema>, "transaction">
    ).transaction(
      async (tx) => {
        const queries = build(tx as unknown as AppDatabase);
        const results: unknown[] = [];
        for (const query of queries) {
          results.push(await query);
        }
        return results as BatchResponse<T>;
      },
    );
  }
  return db.batch(build(db));
}

/** Close the worker's connection pool on shutdown. No-op for the HTTP driver. */
export async function closeDbPool(): Promise<void> {
  if (pool) await pool.end();
  if (pgPool) await pgPool.end();
}
