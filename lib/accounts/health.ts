import type { Platform } from "@/db/schema";

export type AccountHealthStatus = "healthy" | "warning" | "critical";

export type AccountHealthIssueCode =
  | "account_inactive"
  | "token_expired"
  | "token_expires_soon"
  | "missing_refresh_token"
  | "missing_scope"
  | "discord_permalink_metadata_missing";

export type AccountHealthIssue = {
  code: AccountHealthIssueCode;
  severity: Exclude<AccountHealthStatus, "healthy">;
  message: string;
};

export type AccountHealth = {
  status: AccountHealthStatus;
  issues: AccountHealthIssue[];
};

export type AccountHealthInput = {
  platform: Platform;
  status: string;
  refreshToken?: string | null;
  tokenExpiresAt?: Date | null;
  scopes?: string[] | null;
  metadata?: Record<string, unknown> | null;
};

const LABELS: Record<Platform, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  linkedin: "LinkedIn",
  x: "X",
  youtube: "YouTube",
  tiktok: "TikTok",
  pinterest: "Pinterest",
  discord: "Discord",
};

const REQUIRED_SCOPES: Partial<Record<Platform, string[]>> = {
  facebook: ["pages_manage_posts"],
  instagram: ["instagram_content_publish"],
  linkedin: ["w_member_social"],
  x: ["tweet.write"],
  youtube: ["https://www.googleapis.com/auth/youtube.upload"],
  tiktok: ["video.publish"],
  pinterest: ["pins:write"],
};

const REFRESH_TOKEN_PLATFORMS = new Set<Platform>([
  "pinterest",
  "tiktok",
  "x",
  "youtube",
]);

const SOON_MS = 7 * 24 * 60 * 60_000;

export function evaluateAccountHealth(
  account: AccountHealthInput,
  now = new Date(),
): AccountHealth {
  const label = LABELS[account.platform];
  const issues: AccountHealthIssue[] = [];

  if (account.status !== "active") {
    issues.push({
      code: "account_inactive",
      severity: "critical",
      message: `${label} is ${account.status}. Reconnect before scheduling.`,
    });
  }

  if (account.tokenExpiresAt) {
    const msUntilExpiry = account.tokenExpiresAt.getTime() - now.getTime();
    if (msUntilExpiry <= 0) {
      issues.push({
        code: "token_expired",
        severity: "critical",
        message: `${label} token is expired. Reconnect before publishing.`,
      });
    } else if (msUntilExpiry <= SOON_MS) {
      issues.push({
        code: "token_expires_soon",
        severity: "warning",
        message: `${label} token expires within 7 days.`,
      });
    }

  }

  if (REFRESH_TOKEN_PLATFORMS.has(account.platform) && !account.refreshToken) {
    const expiringSoon =
      account.tokenExpiresAt != null &&
      account.tokenExpiresAt.getTime() - now.getTime() <= SOON_MS;
    issues.push({
      code: "missing_refresh_token",
      severity: expiringSoon ? "critical" : "warning",
      message: `${label} is missing a refresh token. Reconnect to avoid expiry.`,
    });
  }

  const requiredScopes = REQUIRED_SCOPES[account.platform] ?? [];
  if (account.scopes && requiredScopes.length > 0) {
    const missing = requiredScopes.filter(
      (scope) => !account.scopes?.includes(scope),
    );
    for (const scope of missing) {
      issues.push({
        code: "missing_scope",
        severity: "critical",
        message: `${label} is missing required scope: ${scope}.`,
      });
    }
  }

  if (account.platform === "discord") {
    const metadata = account.metadata ?? {};
    if (
      typeof metadata.guildId !== "string" ||
      typeof metadata.channelId !== "string"
    ) {
      issues.push({
        code: "discord_permalink_metadata_missing",
        severity: "warning",
        message: "Discord can publish, but channel metadata is missing for permalinks.",
      });
    }
  }

  return {
    status: issues.some((issue) => issue.severity === "critical")
      ? "critical"
      : issues.length > 0
        ? "warning"
        : "healthy",
    issues,
  };
}

export function accountNeedsAttention(health: AccountHealth): boolean {
  return health.status === "critical" || health.status === "warning";
}
