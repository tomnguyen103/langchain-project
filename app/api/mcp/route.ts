import { NextResponse, type NextRequest } from "next/server";

import { buildMcpResponse } from "@/lib/integrations/mcp-server";
import { serializePublicCampaign } from "@/lib/integrations/public-campaigns";
import { requireScopedIntegrationToken } from "@/lib/integrations/route-auth";
import { listCampaignWorkspaces } from "@/lib/repos/campaigns";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const auth = await requireScopedIntegrationToken({
    req,
    kind: "mcp",
    scope: "mcp:read",
    surface: "mcp",
    action: "metadata",
  });
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  return NextResponse.json({
    name: "socialflow",
    transport: "http-jsonrpc",
    tools: ["socialflow.list_campaigns"],
  });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const auth = await requireScopedIntegrationToken({
    req,
    kind: "mcp",
    scope: "mcp:read",
    surface: "mcp",
    action: "jsonrpc",
  });
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let body: { id?: unknown; method?: unknown; params?: unknown };
  try {
    body = (await req.json()) as {
      id?: unknown;
      method?: unknown;
      params?: unknown;
    };
  } catch {
    return NextResponse.json(
      {
        jsonrpc: "2.0",
        id: null,
        error: { code: -32700, message: "Parse error" },
      },
      { status: 400 },
    );
  }

  if (typeof body.method !== "string") {
    return NextResponse.json(
      {
        jsonrpc: "2.0",
        id: body.id ?? null,
        error: { code: -32600, message: "Invalid request" },
      },
      { status: 400 },
    );
  }

  const campaigns = await listCampaignWorkspaces(auth.token.clerkUserId);
  return NextResponse.json(
    buildMcpResponse({
      id: body.id ?? null,
      method: body.method,
      params: body.params,
      campaigns: campaigns.map(serializePublicCampaign),
    }),
  );
}
