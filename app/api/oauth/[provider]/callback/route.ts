import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";

import { getProvider } from "@/lib/oauth/registry";
import { upsertSocialAccount } from "@/lib/repos/accounts";
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
  try {
    const connected = await provider.exchangeCode(code, redirectUri);
    for (const acct of connected) {
      await upsertSocialAccount({
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
    }
    return NextResponse.redirect(
      accountsUrl({ connected: String(connected.length) }),
    );
  } catch (error) {
    console.error("OAuth exchange failed", { provider: providerId, error });
    return NextResponse.redirect(accountsUrl({ error: "exchange_failed" }));
  }
}
