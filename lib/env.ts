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

  // Queue broker (Upstash Redis) — required to enqueue + run the worker
  REDIS_URL: z.string().min(1, "REDIS_URL is required"),

  // Token encryption for social OAuth tokens at rest (Goal 2) — optional for now
  ENCRYPTION_KEY: z
    .string()
    .min(32, "ENCRYPTION_KEY must be at least 32 characters")
    .optional(),

  // LangSmith observability (Goal 4) — optional
  LANGCHAIN_TRACING_V2: z.string().optional(),
  LANGCHAIN_API_KEY: z.string().optional(),
  LANGCHAIN_PROJECT: z.string().optional(),
  LANGCHAIN_ENDPOINT: z.string().optional(),

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
