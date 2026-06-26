import { NextResponse, type NextRequest } from "next/server";

import { serializePublicCampaign } from "@/lib/integrations/public-campaigns";
import { requireScopedIntegrationToken } from "@/lib/integrations/route-auth";
import { listCampaignWorkspaces } from "@/lib/repos/campaigns";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const auth = await requireScopedIntegrationToken({
    req,
    kind: "public_api",
    scope: "public_api:read",
    surface: "public_api",
    action: "campaigns.list",
  });
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const campaigns = await listCampaignWorkspaces(auth.token.clerkUserId);
  return NextResponse.json({
    data: campaigns.map(serializePublicCampaign),
  });
}
