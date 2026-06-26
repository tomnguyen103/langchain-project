import { and, asc, desc, eq, isNull, lte, or, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  webhookDeliveries,
  webhookEndpoints,
  type NewWebhookDelivery,
  type NewWebhookEndpoint,
  type WebhookDelivery,
  type WebhookEndpoint,
} from "@/db/schema";

export async function createWebhookEndpoint(
  data: NewWebhookEndpoint,
): Promise<WebhookEndpoint> {
  const [row] = await db.insert(webhookEndpoints).values(data).returning();
  return row;
}

export async function listWebhookEndpoints(
  clerkUserId: string,
): Promise<WebhookEndpoint[]> {
  return db
    .select()
    .from(webhookEndpoints)
    .where(eq(webhookEndpoints.clerkUserId, clerkUserId))
    .orderBy(desc(webhookEndpoints.createdAt));
}

export async function setWebhookEndpointEnabled(
  id: string,
  clerkUserId: string,
  enabled: boolean,
): Promise<void> {
  await db
    .update(webhookEndpoints)
    .set({ enabled, updatedAt: new Date() })
    .where(
      and(
        eq(webhookEndpoints.id, id),
        eq(webhookEndpoints.clerkUserId, clerkUserId),
      ),
    );
}

export async function createWebhookDelivery(
  data: NewWebhookDelivery,
): Promise<WebhookDelivery> {
  const [row] = await db.insert(webhookDeliveries).values(data).returning();
  return row;
}

export async function enqueueWebhookEvent(opts: {
  clerkUserId: string;
  eventType: string;
  payload: Record<string, unknown>;
}): Promise<void> {
  const endpoints = await listWebhookEndpoints(opts.clerkUserId);
  const targets = endpoints.filter(
    (endpoint) =>
      endpoint.enabled &&
      (endpoint.eventTypes.length === 0 ||
        endpoint.eventTypes.includes(opts.eventType)),
  );
  if (targets.length === 0) return;
  await Promise.all(
    targets.map((endpoint) =>
      createWebhookDelivery({
        endpointId: endpoint.id,
        clerkUserId: opts.clerkUserId,
        eventType: opts.eventType,
        payload: opts.payload,
        status: "pending",
      }),
    ),
  );
}

export async function listDueWebhookDeliveries(
  now = new Date(),
  limit = 50,
): Promise<Array<{ delivery: WebhookDelivery; endpoint: WebhookEndpoint }>> {
  return db
    .select({ delivery: webhookDeliveries, endpoint: webhookEndpoints })
    .from(webhookDeliveries)
    .innerJoin(
      webhookEndpoints,
      eq(webhookDeliveries.endpointId, webhookEndpoints.id),
    )
    .where(
      and(
        eq(webhookEndpoints.enabled, true),
        or(
          and(
            eq(webhookDeliveries.status, "pending"),
            or(
              isNull(webhookDeliveries.nextAttemptAt),
              lte(webhookDeliveries.nextAttemptAt, now),
            ),
          ),
          and(
            eq(webhookDeliveries.status, "sending"),
            lte(webhookDeliveries.nextAttemptAt, now),
          ),
        ),
      ),
    )
    .orderBy(asc(webhookDeliveries.createdAt))
    .limit(limit);
}

export async function claimWebhookDelivery(
  id: string,
  now = new Date(),
): Promise<WebhookDelivery | undefined> {
  const leaseUntil = new Date(now.getTime() + 5 * 60_000);
  const [row] = await db
    .update(webhookDeliveries)
    .set({
      status: "sending",
      attempts: sql`${webhookDeliveries.attempts} + 1`,
      nextAttemptAt: leaseUntil,
      updatedAt: now,
    })
    .where(
      and(
        eq(webhookDeliveries.id, id),
        or(
          and(
            eq(webhookDeliveries.status, "pending"),
            or(
              isNull(webhookDeliveries.nextAttemptAt),
              lte(webhookDeliveries.nextAttemptAt, now),
            ),
          ),
          and(
            eq(webhookDeliveries.status, "sending"),
            lte(webhookDeliveries.nextAttemptAt, now),
          ),
        ),
      ),
    )
    .returning();
  return row;
}

export async function updateWebhookDelivery(
  id: string,
  data: Partial<NewWebhookDelivery>,
): Promise<void> {
  await db
    .update(webhookDeliveries)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(webhookDeliveries.id, id));
}

export async function markWebhookDelivered(endpointId: string): Promise<void> {
  await db
    .update(webhookEndpoints)
    .set({ lastDeliveredAt: new Date(), updatedAt: new Date() })
    .where(eq(webhookEndpoints.id, endpointId));
}
