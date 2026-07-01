/**
 * Shared parsing helpers for OAuth token-exchange responses. Every provider's
 * `exchangeCode` fetches its own token endpoint (different URLs, auth
 * schemes, and required fields), but the expiry math and scope-string
 * parsing were being hand-copied per provider — including one silent
 * divergence (TikTok's `scope` is comma-delimited, everyone else's is
 * space-delimited) that's easy to miss when adding a new provider. Pure, no
 * network/db imports, so they're unit-testable in isolation — see
 * token-response.test.ts.
 */

/** `expires_in` (seconds from now) → an absolute expiry, or `null` if absent. */
export function expiresAtFromSeconds(
  expiresInSeconds: number | undefined,
  now: number = Date.now(),
): Date | null {
  return expiresInSeconds ? new Date(now + expiresInSeconds * 1000) : null;
}

/** A provider's `scope` string → an array, falling back to the requested scopes if absent. */
export function parseScopes(
  scope: string | undefined,
  fallback: string[],
  delimiter = " ",
): string[] {
  return scope ? scope.split(delimiter) : fallback;
}
