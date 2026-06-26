import type { NextRequest } from "next/server";

import type { IntegrationToken, IntegrationTokenKind } from "@/db/schema";
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
  | { ok: false; status: 401 | 403; error: string };

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

  await createIntegrationAuditLog({
    clerkUserId: token.clerkUserId,
    tokenId: token.id,
    surface: opts.surface,
    action: opts.action,
    result: "allowed",
  });
  return { ok: true, token };
}
