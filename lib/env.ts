import { z } from "zod";

/**
 * Centralized, validated environment access (server-side).
 *
 * - Required vars fail fast on import so misconfiguration surfaces immediately.
 * - Set `SKIP_ENV_VALIDATION=true` to bypass validation (used by CI builds and
 *   type generation, where real secrets are not present).
 *
 * Each phase extends this schema as new integrations come online
 * (Clerk → Goal 1, ImageKit → Goal 2, Gemini/LangSmith → Goal 4, etc.).
 */
const EnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  // Database (Neon) — required at runtime
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  // DB driver selection: "http" (default, serverless app) or "pool" (the
  // long-running worker uses a pooled WebSocket connection). See db/index.ts.
  DB_DRIVER: z.enum(["http", "pool"]).optional(),

  // Queue broker (Upstash Redis) — required to enqueue + run the worker
  REDIS_URL: z.string().min(1, "REDIS_URL is required"),

  // Auth (Clerk) — required
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z
    .string()
    .min(1, "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is required"),
  CLERK_SECRET_KEY: z.string().min(1, "CLERK_SECRET_KEY is required"),

  // Token encryption for social OAuth tokens at rest — required
  ENCRYPTION_KEY: z
    .string()
    .min(32, "ENCRYPTION_KEY must be at least 32 characters"),

  // Media storage (ImageKit)
  NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY: z.string().min(1),
  IMAGEKIT_PRIVATE_KEY: z.string().min(1),
  NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT: z.string().min(1),

  // Meta (Facebook + Instagram) OAuth + Graph API — optional; the connect
  // option is hidden in the UI when unset.
  META_APP_ID: z.string().optional(),
  META_APP_SECRET: z.string().optional(),
  // Verify token for the Meta comments webhook handshake — optional.
  META_WEBHOOK_VERIFY_TOKEN: z.string().optional(),

  // LinkedIn OAuth — optional; the connect option is hidden in the UI when unset.
  LINKEDIN_CLIENT_ID: z.string().optional(),
  LINKEDIN_CLIENT_SECRET: z.string().optional(),

  // TikTok OAuth + Content Posting API — optional; hidden in the UI when unset.
  TIKTOK_CLIENT_KEY: z.string().optional(),
  TIKTOK_CLIENT_SECRET: z.string().optional(),

  // X (Twitter) OAuth2 + v2 API — optional; hidden in the UI when unset.
  X_CLIENT_ID: z.string().optional(),
  X_CLIENT_SECRET: z.string().optional(),

  // Pinterest OAuth2 + v5 API — optional; hidden in the UI when unset.
  PINTEREST_CLIENT_ID: z.string().optional(),
  PINTEREST_CLIENT_SECRET: z.string().optional(),

  // YouTube (Google) OAuth2 + Data API — optional; hidden in the UI when unset.
  YOUTUBE_CLIENT_ID: z.string().optional(),
  YOUTUBE_CLIENT_SECRET: z.string().optional(),

  // LLM providers (Gemini default) — optional; the agent errors clearly if the
  // selected provider's key is missing.
  LLM_PROVIDER: z.enum(["gemini", "openai", "anthropic"]).optional(),
  GOOGLE_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),

  // Web research (Goal 5) — optional; research falls back to LLM knowledge if unset.
  TAVILY_API_KEY: z.string().optional(),

  // LangSmith observability (Goal 4) — optional
  LANGCHAIN_TRACING_V2: z.string().optional(),
  LANGCHAIN_API_KEY: z.string().optional(),
  LANGCHAIN_PROJECT: z.string().optional(),
  LANGCHAIN_ENDPOINT: z.string().optional(),
  // Workspace + project ids (UUIDs) for building run deep links (Goal 9).
  LANGSMITH_ORG_ID: z.uuid().optional(),
  LANGSMITH_PROJECT_ID: z.uuid().optional(),

  // Optional bearer token guarding /api/health/queues so external uptime
  // monitors can scrape queue depths without a Clerk session. When unset, the
  // endpoint falls back to requiring an authenticated session.
  HEALTH_CHECK_TOKEN: z.string().optional(),

  // MCP (inward) — optional; agents can call tools on a configured MCP server.
  MCP_SERVER_URL: z.string().url().optional(),
  MCP_SERVER_TOKEN: z.string().optional(),

  // A2A (outward) — optional; expose the content agent over Agent2Agent. The
  // endpoint is disabled unless A2A_ENABLED="true"; A2A_TOKEN is the bearer
  // secret callers must present.
  A2A_ENABLED: z.string().optional(),
  A2A_TOKEN: z.string().optional(),
  // The single tenant (Clerk user id) the A2A token acts as. Required for A2A to
  // be enabled — the endpoint NEVER derives the tenant from the request body.
  A2A_TENANT_ID: z.string().optional(),

  // Public
  NEXT_PUBLIC_APP_URL: z.string().optional(),
});

export type Env = z.infer<typeof EnvSchema>;

function loadEnv(): Env {
  if (process.env.SKIP_ENV_VALIDATION === "true") {
    return process.env as unknown as Env;
  }

  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid environment variables:\n${issues}`);
  }
  return parsed.data;
}

export const env = loadEnv();
