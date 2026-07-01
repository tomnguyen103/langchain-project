import type { Job } from "bullmq";

import { isAuthRejection } from "@/lib/platforms/auth-rejection";
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
// Fallback expiry when a connector's refresh returns no expiry — keeps the
// account out of the immediate re-refresh loop without nulling the column.
const SYNTHETIC_EXPIRY_MS = 60 * 24 * 60 * 60 * 1000; // 60 days

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
        // If the connector returns no expiry, set a synthetic future one so the
        // account isn't re-selected for refresh on every tick (the stale past
        // expiry would otherwise keep matching listAccountsNeedingRefresh).
        tokenExpiresAt:
          tokens.expiresAt ?? new Date(Date.now() + SYNTHETIC_EXPIRY_MS),
      });
      refreshed += 1;
    } catch (error) {
      // Only flag the account expired on a DEFINITIVE auth rejection (the
      // provider says the refresh token is invalid). A transient network/5xx
      // error leaves it active to retry next cycle, so a blip can't force an
      // unnecessary reconnect.
      if (isAuthRejection(error)) {
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
