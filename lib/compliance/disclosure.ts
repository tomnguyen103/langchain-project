import type { DisclosurePolicy, Platform } from "@/db/schema";

/** Bump when the disclosure logic/wording changes — recorded on each ledger row. */
export const DISCLOSURE_POLICY_VERSION = "v1";

export const DEFAULT_DISCLOSURE_POLICY: DisclosurePolicy = {
  labelAiContent: false,
  disclosureText: null,
  jurisdiction: null,
};

/** Platforms that expose a native "AI-generated" content label/flag. */
const AI_LABEL_PLATFORMS: ReadonlySet<Platform> = new Set<Platform>([
  "instagram",
  "facebook",
  "tiktok",
  "youtube",
]);

export function platformSupportsAiLabel(platform: Platform): boolean {
  return AI_LABEL_PLATFORMS.has(platform);
}

export type DisclosureOutcome = {
  /** Body with the disclosure appended (unchanged when nothing was applied). */
  body: string;
  /** Whether the platform's native AI label should be flagged for this post. */
  platformLabelApplied: boolean;
  /** The disclosure text actually appended, or null. */
  disclosureText: string | null;
};

/**
 * Apply a tenant's disclosure policy to one platform draft: append the
 * disclosure text when it fits within the platform's limit, and flag the native
 * AI label where the platform supports one. Pure — the caller persists the body
 * and writes a disclosure_ledger row from the outcome.
 *
 * The post is never truncated to fit a disclosure: if the text won't fit, the
 * body is left intact and only the native label is flagged.
 */
export function applyDisclosure(args: {
  body: string;
  maxBodyLength: number;
  platform: Platform;
  policy: DisclosurePolicy;
}): DisclosureOutcome {
  const { body, maxBodyLength, platform, policy } = args;
  if (!policy.labelAiContent) {
    return { body, platformLabelApplied: false, disclosureText: null };
  }

  const platformLabelApplied = platformSupportsAiLabel(platform);
  const text = policy.disclosureText?.trim() ?? "";
  if (text.length === 0) {
    return { body, platformLabelApplied, disclosureText: null };
  }

  const addition = `\n\n${text}`;
  if (body.length + addition.length > maxBodyLength) {
    return { body, platformLabelApplied, disclosureText: null };
  }
  return { body: body + addition, platformLabelApplied, disclosureText: text };
}
