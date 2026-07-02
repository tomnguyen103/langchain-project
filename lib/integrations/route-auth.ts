import type { NextRequest } from "next/server";

import type { IntegrationToken, IntegrationTokenKind } from "@/db/schema";
import { rateLimit } from "@/lib/rate-limit";
import {
  authenticateIntegrationToken,
  createIntegrationAuditLog,
} from "@/lib/repos/integrations";
import {
  hasIntegrationScope,
  type IntegrationScope,
} from "@/lib/integrations/tokens";

export type ScopedIntegrationAuth =
  | { ok: true; token: IntegrationToken }
  | { ok: false; status: 401 | 403 | 429; error: string };

// Per-token, per-surface: an integration client polling/listing shouldn't hit
// this under normal use, but a misbehaving or compromised token can't hammer
// the endpoint either.
const RATE_LIMIT_PER_MINUTE = 60;

export async function requireScopedIntegrationToken(opts: {
  req: NextRequest;
  kind: IntegrationTokenKind;
  scope: IntegrationScope;
  surface: string;
  action: string;
}): Promise<ScopedIntegrationAuth> {
  const authHeader = opts.req.headers.get("authorization") ?? "";
  const plaintext = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : "";
  if (!plaintext) return { ok: false, status: 401, error: "unauthorized" };

  const token = await authenticateIntegrationToken({
    plaintext,
    kind: opts.kind,
  });
  if (!token) return { ok: false, status: 401, error: "unauthorized" };

  if (!hasIntegrationScope(token.scopes, opts.scope)) {
    await createIntegrationAuditLog({
      clerkUserId: token.clerkUserId,
      tokenId: token.id,
      surface: opts.surface,
      action: opts.action,
      result: "denied",
      metadata: { missingScope: opts.scope },
    });
    return { ok: false, status: 403, error: "forbidden" };
  }

  const withinLimit = await rateLimit(
    `${opts.surface}:${token.id}`,
    RATE_LIMIT_PER_MINUTE,
    60_000,
  );
  if (!withinLimit) {
    await createIntegrationAuditLog({
      clerkUserId: token.clerkUserId,
      tokenId: token.id,
      surface: opts.surface,
      action: opts.action,
      result: "denied",
      metadata: { reason: "rate_limited" },
    });
    return { ok: false, status: 429, error: "rate limited" };
  }

  await createIntegrationAuditLog({
    clerkUserId: token.clerkUserId,
    tokenId: token.id,
    surface: opts.surface,
    action: opts.action,
    result: "allowed",
  });
  return { ok: true, token };
}
