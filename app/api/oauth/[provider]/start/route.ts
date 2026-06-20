import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";

import { getProvider } from "@/lib/oauth/registry";
import { getAppUrl } from "@/lib/utils/app-url";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.redirect(new URL("/sign-in", req.url));
  }

  const { provider: providerId } = await params;
  const provider = getProvider(providerId);
  if (!provider) {
    return NextResponse.json({ error: "Unknown provider" }, { status: 404 });
  }

  const state = randomBytes(16).toString("hex");
  const redirectUri = `${getAppUrl(req)}/api/oauth/${providerId}/callback`;

  const cookieStore = await cookies();
  cookieStore.set(`oauth_state_${providerId}`, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });

  return NextResponse.redirect(provider.getAuthUrl(state, redirectUri));
}
