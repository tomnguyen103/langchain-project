import { and, desc, eq, gt, isNull, or } from "drizzle-orm";

import { db } from "@/db";
import {
  integrationAuditLogs,
  integrationTokens,
  type IntegrationAuditLog,
  type IntegrationToken,
  type IntegrationTokenKind,
  type NewIntegrationAuditLog,
  type NewIntegrationToken,
} from "@/db/schema";
import { hashIntegrationToken, safeHashEquals } from "@/lib/integrations/tokens";

export async function createIntegrationToken(
  data: NewIntegrationToken,
): Promise<IntegrationToken> {
  const [row] = await db.insert(integrationTokens).values(data).returning();
  return row;
}

export async function listIntegrationTokens(
  clerkUserId: string,
): Promise<IntegrationToken[]> {
  return db
    .select()
    .from(integrationTokens)
    .where(eq(integrationTokens.clerkUserId, clerkUserId))
    .orderBy(desc(integrationTokens.createdAt))
    .limit(50);
}

export async function revokeIntegrationToken(
  id: string,
  clerkUserId: string,
): Promise<void> {
  await db
    .update(integrationTokens)
    .set({ status: "revoked", revokedAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(integrationTokens.id, id),
        eq(integrationTokens.clerkUserId, clerkUserId),
      ),
    );
}

export async function authenticateIntegrationToken(opts: {
  plaintext: string;
  kind: IntegrationTokenKind;
}): Promise<IntegrationToken | undefined> {
  const tokenHash = hashIntegrationToken(opts.plaintext);
  const [row] = await db
    .select()
    .from(integrationTokens)
    .where(
      and(
        eq(integrationTokens.kind, opts.kind),
        eq(integrationTokens.status, "active"),
        eq(integrationTokens.tokenHash, tokenHash),
        or(isNull(integrationTokens.expiresAt), gt(integrationTokens.expiresAt, new Date())),
      ),
    )
    .limit(1);
  if (!row || !safeHashEquals(row.tokenHash, tokenHash)) return undefined;

  await db
    .update(integrationTokens)
    .set({ lastUsedAt: new Date(), updatedAt: new Date() })
    .where(eq(integrationTokens.id, row.id));
  return row;
}

export async function createIntegrationAuditLog(
  data: NewIntegrationAuditLog,
): Promise<IntegrationAuditLog> {
  const [row] = await db.insert(integrationAuditLogs).values(data).returning();
  return row;
}
