/**
 * Media-URL SSRF guard. A media URL we later fetch server-side (e.g. the YouTube
 * connector downloads the video) must be an https URL on the trusted ImageKit
 * host — otherwise an attacker could store an internal/metadata URL and have our
 * server fetch it. Pure (no env) → unit-testable; callers pass the allowed host.
 */
export function isAllowedMediaUrl(
  rawUrl: string,
  allowedHost: string | null,
): boolean {
  if (!allowedHost) return false;
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return false;
  }
  return parsed.protocol === "https:" && parsed.host === allowedHost;
}
