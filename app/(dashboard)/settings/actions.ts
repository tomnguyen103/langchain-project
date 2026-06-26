"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireRole } from "@/lib/auth/current-role";
import { normalizeLearnedMemoryInput } from "@/lib/brand/learned-notes";
import { normalizeBrandProfileInput } from "@/lib/brand/profile-input";
import { getOrgId, requireUserId } from "@/lib/clerk";
import {
  generateIntegrationToken,
  hashIntegrationToken,
  normalizeIntegrationScopes,
  type IntegrationScope,
} from "@/lib/integrations/tokens";
import { encrypt } from "@/lib/utils/crypto";
import { generateWebhookSecret } from "@/lib/webhooks/signing";
import { isAllowedWebhookUrl } from "@/lib/webhooks/url";
import {
  setDisclosurePolicy,
  setLearnedMemory,
  upsertBrandProfile,
} from "@/lib/repos/brand-profiles";
import {
  createIntegrationToken,
  revokeIntegrationToken,
} from "@/lib/repos/integrations";
import {
  createWebhookEndpoint,
  setWebhookEndpointEnabled,
} from "@/lib/repos/webhooks";

// Server actions receive untrusted runtime input — validate the shape before
// normalizing so a malformed payload is a controlled error, not a 500 thrown
// from .trim()/.split() on a non-string field.
const BrandProfileInput = z.object({
  voice: z.string(),
  bannedTerms: z.string(),
  policyRules: z.string(),
  policyPacks: z.array(z.string()),
  autoPublishEnabled: z.boolean(),
  autoPublishThreshold: z.number(),
});

export async function saveBrandProfileAction(input: unknown): Promise<void> {
  const parsed = BrandProfileInput.safeParse(input);
  if (!parsed.success) throw new Error("Invalid brand profile.");

  const userId = await requireUserId();
  const orgId = await getOrgId();
  const normalized = normalizeBrandProfileInput(parsed.data);
  await upsertBrandProfile(userId, { clerkOrgId: orgId, ...normalized });
  revalidatePath("/settings");
}

const DisclosurePolicyInput = z.object({
  labelAiContent: z.boolean(),
  disclosureText: z.string(),
  jurisdiction: z.string(),
});

const MAX_DISCLOSURE_LENGTH = 280;
const MAX_JURISDICTION_LENGTH = 60;

/** Save the tenant's AI-content disclosure policy (Aletheia). */
export async function saveDisclosurePolicyAction(input: unknown): Promise<void> {
  const parsed = DisclosurePolicyInput.safeParse(input);
  if (!parsed.success) throw new Error("Invalid disclosure policy.");

  const userId = await requireUserId();
  await setDisclosurePolicy(userId, {
    labelAiContent: parsed.data.labelAiContent,
    disclosureText:
      parsed.data.disclosureText.trim().slice(0, MAX_DISCLOSURE_LENGTH) || null,
    jurisdiction:
      parsed.data.jurisdiction.trim().slice(0, MAX_JURISDICTION_LENGTH) || null,
  });
  revalidatePath("/settings");
}

const LearnedMemoryInput = z.object({
  topics: z.string(),
});

export async function saveLearnedMemoryAction(input: unknown): Promise<void> {
  const parsed = LearnedMemoryInput.safeParse(input);
  if (!parsed.success) throw new Error("Invalid learned memory.");

  await requireRole("admin");
  const userId = await requireUserId();
  await setLearnedMemory(userId, normalizeLearnedMemoryInput(parsed.data));
  revalidatePath("/settings");
}

export async function clearLearnedMemoryAction(): Promise<void> {
  await requireRole("admin");
  const userId = await requireUserId();
  await setLearnedMemory(userId, null);
  revalidatePath("/settings");
}

const INTEGRATION_TOKEN_SCOPES = {
  a2a: ["a2a:read", "a2a:message"],
  public_api: ["public_api:read"],
  mcp: ["mcp:read"],
} as const satisfies Record<string, IntegrationScope[]>;

const IntegrationTokenInput = z.object({
  kind: z.enum(["a2a", "public_api", "mcp"]),
  name: z.string().trim().min(1).max(80),
  scopes: z.array(z.string()).default([]),
});

export async function createIntegrationTokenAction(input: unknown): Promise<{
  plaintext: string;
}> {
  const parsed = IntegrationTokenInput.safeParse(input);
  if (!parsed.success) throw new Error("Invalid token request.");

  await requireRole("admin");
  const userId = await requireUserId();
  const scopes = normalizeIntegrationScopes(
    parsed.data.scopes,
    [...INTEGRATION_TOKEN_SCOPES[parsed.data.kind]],
  );
  if (scopes.length === 0) throw new Error("Select at least one scope.");

  const token = generateIntegrationToken(parsed.data.kind);
  await createIntegrationToken({
    clerkUserId: userId,
    kind: parsed.data.kind,
    name: parsed.data.name,
    tokenHash: token.tokenHash,
    scopes,
    status: "active",
  });
  revalidatePath("/settings");
  return { plaintext: token.plaintext };
}

export async function revokeIntegrationTokenAction(id: string): Promise<void> {
  await requireRole("admin");
  const userId = await requireUserId();
  await revokeIntegrationToken(id, userId);
  revalidatePath("/settings");
}

const WebhookEndpointInput = z.object({
  name: z.string().trim().min(1).max(80),
  url: z.string().url().max(500),
  eventTypes: z.array(z.string()).default([]),
});

const WEBHOOK_EVENTS = new Set([
  "campaign.created",
  "campaign.source_created",
  "agent.run_started",
]);

export async function createWebhookEndpointAction(input: unknown): Promise<{
  secret: string;
}> {
  const parsed = WebhookEndpointInput.safeParse(input);
  if (!parsed.success) throw new Error("Invalid webhook endpoint.");
  if (!isAllowedWebhookUrl(parsed.data.url)) {
    throw new Error("Webhook URL must be an HTTPS public endpoint.");
  }

  await requireRole("admin");
  const userId = await requireUserId();
  const eventTypes = parsed.data.eventTypes.filter((event) =>
    WEBHOOK_EVENTS.has(event),
  );
  const secret = generateWebhookSecret();
  await createWebhookEndpoint({
    clerkUserId: userId,
    name: parsed.data.name,
    url: parsed.data.url,
    secretHash: hashIntegrationToken(secret),
    secretCiphertext: encrypt(secret),
    eventTypes,
    enabled: true,
  });
  revalidatePath("/settings");
  return { secret };
}

export async function setWebhookEndpointEnabledAction(
  id: string,
  enabled: boolean,
): Promise<void> {
  await requireRole("admin");
  const userId = await requireUserId();
  await setWebhookEndpointEnabled(id, userId, enabled);
  revalidatePath("/settings");
}
