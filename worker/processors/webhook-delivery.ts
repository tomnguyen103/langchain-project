import type { Job } from "bullmq";

import {
  claimWebhookDelivery,
  markWebhookDelivered,
  listDueWebhookDeliveries,
  updateWebhookDelivery,
} from "@/lib/repos/webhooks";
import { decrypt } from "@/lib/utils/crypto";
import { postWebhookJson } from "@/lib/webhooks/http";
import { signWebhookPayload } from "@/lib/webhooks/signing";
import { assertAllowedWebhookDestination } from "@/lib/webhooks/url";
import { logger } from "../logger";

const MAX_ATTEMPTS = 5;
const TIMEOUT_MS = 10_000;

export async function webhookDeliveryProcessor(job: Job): Promise<void> {
  const due = await listDueWebhookDeliveries(new Date(), 50);
  let delivered = 0;
  let failed = 0;

  for (const { delivery, endpoint } of due) {
    const claimed = await claimWebhookDelivery(delivery.id);
    if (!claimed) continue;

    const attempts = claimed.attempts;
    const body = JSON.stringify({
      id: claimed.id,
      eventType: claimed.eventType,
      payload: claimed.payload,
      createdAt: claimed.createdAt.toISOString(),
    });
    const timestamp = Math.floor(Date.now() / 1000);

    try {
      const destination = await assertAllowedWebhookDestination(endpoint.url);
      const secret = decrypt(endpoint.secretCiphertext);
      const signature = signWebhookPayload({ secret, timestamp, body });
      const response = await postWebhookJson({
        destination,
        headers: {
          "content-type": "application/json",
          "x-socialflow-event": claimed.eventType,
          "x-socialflow-signature": `sha256=${signature}`,
          "x-socialflow-timestamp": String(timestamp),
        },
        body,
        timeoutMs: TIMEOUT_MS,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      await updateWebhookDelivery(claimed.id, {
        status: "delivered",
        nextAttemptAt: null,
        lastError: null,
      });
      await markWebhookDelivered(endpoint.id);
      delivered += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const terminal = attempts >= MAX_ATTEMPTS;
      await updateWebhookDelivery(claimed.id, {
        status: terminal ? "failed" : "pending",
        nextAttemptAt: terminal
          ? null
          : new Date(Date.now() + Math.min(60 * 60_000, attempts * attempts * 60_000)),
        lastError: message,
      });
      failed += 1;
    }
  }

  logger.info("webhook-delivery: sweep complete", {
    jobId: job.id,
    checked: due.length,
    delivered,
    failed,
  });
}
