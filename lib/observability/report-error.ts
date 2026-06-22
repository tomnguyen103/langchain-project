type Meta = Record<string, unknown>;

/**
 * App-side error-reporting seam (routes, server actions, error boundaries).
 *
 * Emits a structured JSON line today — mirroring the worker's logger so app +
 * worker logs are consistent — and is the single place to forward to Sentry /
 * OpenTelemetry once a DSN is configured. Use this instead of bare console.error
 * so production exceptions are structured and centrally wired.
 */
export function reportError(msg: string, error: unknown, meta?: Meta): void {
  const normalized =
    error instanceof Error
      ? { name: error.name, message: error.message, stack: error.stack }
      : { message: String(error) };

  console.error(
    JSON.stringify({
      ts: new Date().toISOString(),
      level: "error",
      msg,
      error: normalized,
      ...meta,
    }),
  );

  // TODO(observability): forward to Sentry/OTel here once a DSN is configured.
}
