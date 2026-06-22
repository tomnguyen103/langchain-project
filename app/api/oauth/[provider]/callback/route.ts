import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";

import { getPlanLimits } from "@/lib/billing/entitlements";
import { getProvider } from "@/lib/oauth/registry";
import { getConnector, hasConnector } from "@/lib/platforms/registry";
import { registerCommentPoll } from "@/lib/queue/jobs";
import { listSocialAccounts, upsertSocialAccount } from "@/lib/repos/accounts";
import { reportError } from "@/lib/observability/report-error";
import { encrypt, encryptNullable } from "@/lib/utils/crypto";
import { getAppUrl } from "@/lib/utils/app-url";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { userId, orgId } = await auth();
  if (!userId) {
    return NextResponse.redirect(new URL("/sign-in", req.url));
  }

  const { provider: providerId } = await params;
  const provider = getProvider(providerId);

  const accountsUrl = (query: Record<string, string>) => {
    const url = new URL("/accounts", getAppUrl(req));
    for (const [key, value] of Object.entries(query)) {
      url.searchParams.set(key, value);
    }
    return url;
  };

  if (!provider) {
    return NextResponse.redirect(accountsUrl({ error: "unknown_provider" }));
  }

  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const oauthError = req.nextUrl.searchParams.get("error");

  const cookieStore = await cookies();
  const cookieKey = `oauth_state_${providerId}`;
  const expectedState = cookieStore.get(cookieKey)?.value;
  cookieStore.delete(cookieKey);

  if (oauthError) {
    return NextResponse.redirect(accountsUrl({ error: oauthError }));
  }
  if (!code || !state || !expectedState || state !== expectedState) {
    return NextResponse.redirect(accountsUrl({ error: "invalid_state" }));
  }

  const redirectUri = `${getAppUrl(req)}/api/oauth/${providerId}/callback`;

  let connected;
  try {
    connected = await provider.exchangeCode(code, redirectUri, state);
  } catch (error) {
    reportError("OAuth exchange failed", error, { provider: providerId });
    return NextResponse.redirect(accountsUrl({ error: "exchange_failed" }));
  }

  // Defense-in-depth: re-enforce the account limit at the point of persistence.
  // The start route's pre-check can be bypassed by concurrent OAuth flows or a
  // direct callback hit. Re-linking an already-connected account is always
  // allowed (it's an update, not a new slot).
  const limits = await getPlanLimits();
  const existing = await listSocialAccounts(userId);
  const linkedKeys = new Set(
    existing.map((a) => `${a.platform}:${a.platformAccountId}`),
  );
  let accountCount = existing.length;
  let skippedOverLimit = 0;

  // Save each account independently so one failure doesn't lose the others.
  let saved = 0;
  for (const acct of connected) {
    const isNew = !linkedKeys.has(
      `${acct.platform}:${acct.platformAccountId}`,
    );
    if (isNew && accountCount >= limits.accounts) {
      skippedOverLimit += 1;
      continue;
    }
    try {
      const savedAccount = await upsertSocialAccount({
        clerkUserId: userId,
        clerkOrgId: orgId ?? null,
        platform: acct.platform,
        platformAccountId: acct.platformAccountId,
        handle: acct.handle ?? null,
        displayName: acct.displayName ?? null,
        avatarUrl: acct.avatarUrl ?? null,
        accessToken: encrypt(acct.accessToken),
        refreshToken: encryptNullable(acct.refreshToken),
        tokenExpiresAt: acct.expiresAt ?? null,
        scopes: acct.scopes,
        metadata: acct.metadata,
        status: "active",
        lastValidatedAt: new Date(),
      });
      saved += 1;
      if (isNew) accountCount += 1;

      // Start comment polling for comment-capable platforms. Best-effort: a
      // queue/Redis hiccup must not fail the connection itself.
      if (
        hasConnector(savedAccount.platform) &&
        getConnector(savedAccount.platform).capabilities.supportsComments
      ) {
        await registerCommentPoll(savedAccount.id).catch((error) => {
          reportError("Failed to register comment poll", error, {
            accountId: savedAccount.id,
          });
        });
      }
    } catch (error) {
      reportError("Failed to save connected account", error, {
        provider: providerId,
        platform: acct.platform,
      });
    }
  }

  if (saved === 0) {
    if (skippedOverLimit > 0) {
      return NextResponse.redirect(accountsUrl({ error: "account_limit" }));
    }
    return NextResponse.redirect(
      accountsUrl({ error: connected.length ? "save_failed" : "no_accounts" }),
    );
  }
  return NextResponse.redirect(accountsUrl({ connected: String(saved) }));
}
