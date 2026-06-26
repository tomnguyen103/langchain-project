import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

import type { IntegrationTokenKind } from "@/db/schema";

export type IntegrationScope =
  | "a2a:message"
  | "a2a:read"
  | "public_api:read"
  | "mcp:read";

export function generateIntegrationToken(kind: IntegrationTokenKind): {
  plaintext: string;
  tokenHash: string;
} {
  const plaintext = `sf_${kind}_${randomBytes(32).toString("base64url")}`;
  return { plaintext, tokenHash: hashIntegrationToken(plaintext) };
}

export function hashIntegrationToken(plaintext: string): string {
  return createHash("sha256").update(plaintext).digest("hex");
}

export function safeHashEquals(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function hasIntegrationScope(
  scopes: string[],
  required: IntegrationScope,
): boolean {
  return scopes.includes(required);
}

export function normalizeIntegrationScopes(
  scopes: string[],
  allowed: IntegrationScope[],
): IntegrationScope[] {
  const allowedSet = new Set<IntegrationScope>(allowed);
  const out: IntegrationScope[] = [];
  for (const raw of scopes) {
    const scope = raw.trim() as IntegrationScope;
    if (!allowedSet.has(scope)) continue;
    if (!out.includes(scope)) out.push(scope);
  }
  return out;
}
