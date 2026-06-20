import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Liveness probe for the web app. Deeper DB/Redis checks can be added later. */
export function GET() {
  return NextResponse.json({
    status: "ok",
    service: "socialflow-web",
    time: new Date().toISOString(),
  });
}
