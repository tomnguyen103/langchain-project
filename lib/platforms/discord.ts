import type { SocialAccount } from "@/db/schema";

import { AbstractConnector } from "./base";
import { PLATFORM_META } from "./constants";
import type {
  PlatformCapabilities,
  PublishInput,
  PublishResult,
} from "./types";

/**
 * Posts a message to a Discord channel via an incoming webhook. The account's
 * encrypted access token holds the full webhook URL (Discord webhooks aren't
 * OAuth — they're connected with a pasted URL). Comments aren't supported.
 */
class DiscordConnector extends AbstractConnector {
  readonly platform = "discord" as const;

  readonly capabilities: PlatformCapabilities = {
    maxBodyLength: PLATFORM_META.discord.maxBodyLength,
    media: { images: true, video: false, maxImages: 10, required: false },
    supportsComments: false,
    supportsNativeSchedule: false,
  };

  async publishNow(
    input: PublishInput,
    account: SocialAccount,
  ): Promise<PublishResult> {
    const webhookUrl = this.accessToken(account);
    const content = input.body.slice(0, this.capabilities.maxBodyLength);
    const images = input.media.filter(
      (m) => m.type === "image" || m.type === "gif",
    );

    const payload: Record<string, unknown> = {};
    if (content) payload.content = content;
    if (images.length > 0) {
      payload.embeds = images.slice(0, 10).map((m) => ({ image: { url: m.url } }));
    }
    if (!payload.content && !payload.embeds) {
      throw new Error("Discord message needs text or media.");
    }

    // wait=true makes Discord return the created message (with its id).
    const url = new URL(webhookUrl);
    url.searchParams.set("wait", "true");
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(
        `Discord publish failed (${res.status}): ${detail.slice(0, 200)}`,
      );
    }
    const msg = (await res.json()) as { id: string };
    // No public permalink without the guild id (the webhook doesn't return it).
    return { externalPostId: msg.id, raw: msg };
  }
}

export const discordConnector = new DiscordConnector();
