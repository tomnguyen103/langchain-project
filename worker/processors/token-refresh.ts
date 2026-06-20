import type { Job } from "bullmq";

import { getConnector, hasConnector } from "@/lib/platforms/registry";
import {
  listAccountsNeedingRefresh,
  setAccountStatus,
  updateAccountTokens,
} from "@/lib/repos/accounts";
import { encrypt } from "@/lib/utils/crypto";
import { logger } from "../logger";

// Refresh tokens that expire within this window ahead of now.
const REFRESH_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * Proactively refresh social tokens nearing expiry. Connectors that can't
 * refresh (or whose refresh fails) leave the account active until the token has
 * actually expired, at which point it's flagged so the UI can prompt a reconnect.
 */
export async function tokenRefreshProcessor(_job: Job): Promise<void> {
  const threshold = new Date(Date.now() + REFRESH_WINDOW_MS);
  const accounts = await listAccountsNeedingRefresh(threshold);
  if (accounts.length === 0) return;

  let refreshed = 0;
  let expired = 0;
  for (const account of accounts) {
    if (!hasConnector(account.platform)) continue;
    try {
      const tokens = await getConnector(account.platform).refreshToken(account);
      await updateAccountTokens(account.id, {
        accessToken: encrypt(tokens.accessToken),
        refreshToken: tokens.refreshToken
          ? encrypt(tokens.refreshToken)
          : undefined,
        tokenExpiresAt: tokens.expiresAt ?? null,
      });
      refreshed += 1;
    } catch (error) {
      if (account.tokenExpiresAt && account.tokenExpiresAt < new Date()) {
        await setAccountStatus(account.id, "expired");
        expired += 1;
      }
      logger.warn("token-refresh: could not refresh", {
        accountId: account.id,
        platform: account.platform,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  logger.info("token-refresh: run", {
    checked: accounts.length,
    refreshed,
    expired,
  });
}
