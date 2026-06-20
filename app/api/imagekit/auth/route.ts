import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

import { env } from "@/lib/env";
import { getUploadAuthParams } from "@/lib/imagekit/server";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({
    ...getUploadAuthParams(),
    publicKey: env.NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY,
  });
}
