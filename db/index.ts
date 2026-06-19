import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import { env } from "@/lib/env";
import * as schema from "./schema";

/**
 * Drizzle client over Neon's HTTP driver — stateless and serverless-friendly,
 * shared by both the Next.js app and the BullMQ worker.
 */
const sql = neon(env.DATABASE_URL);

export const db = drizzle(sql, { schema });

export type Database = typeof db;
export { schema };
