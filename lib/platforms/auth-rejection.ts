/**
 * Whether a token-refresh error is a definitive auth rejection (the provider
 * says the refresh token is invalid) vs. a transient network/5xx error. Pure
 * (no db/env/network imports) so it's unit-testable without a real connector —
 * see auth-rejection.test.ts.
 */
export function isAuthRejection(error: unknown): boolean {
  const status =
    error && typeof error === "object"
      ? (error as { status?: unknown }).status
      : undefined;
  if (status === 400 || status === 401 || status === 403) return true;
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  return message.includes("invalid_grant") || message.includes("invalid_token");
}
