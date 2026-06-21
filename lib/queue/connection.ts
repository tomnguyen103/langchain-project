import type { ConnectionOptions } from "bullmq";

import { env } from "@/lib/env";

/**
 * BullMQ connection options derived from REDIS_URL.
 *
 * We hand BullMQ plain options (not a shared ioredis instance) so it creates and
 * owns the right connections — including the dedicated blocking connection each
 * Worker needs. `maxRetriesPerRequest: null` is REQUIRED by BullMQ and Upstash.
 */
function buildConnection(url: string): ConnectionOptions {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : 6379,
    username: parsed.username ? decodeURIComponent(parsed.username) : undefined,
    password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
    tls: parsed.protocol === "rediss:" ? {} : undefined,
    connectTimeout: 5000,
    commandTimeout: 8000,
    maxRetriesPerRequest: null,
  };
}

export const connection: ConnectionOptions = buildConnection(env.REDIS_URL);
