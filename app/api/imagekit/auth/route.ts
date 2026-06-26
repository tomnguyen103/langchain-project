import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

import { getCurrentRole } from "@/lib/auth/current-role";
import { canCreate } from "@/lib/auth/roles";
import { env } from "@/lib/env";
import { getUploadAuthParams } from "@/lib/imagekit/server";
import {
  MEDIA_UPLOAD_FOLDER,
  imageKitUploadChecks,
  validateMediaUpload,
} from "@/lib/media/validation";
import { rateLimit } from "@/lib/rate-limit";

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canCreate(await getCurrentRole())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!(await rateLimit(`imagekit-auth:${userId}`, 30, 60_000))) {
    return NextResponse.json(
      { error: "Too many upload attempts. Please try again shortly." },
      { status: 429 },
    );
  }

  const url = new URL(req.url);
  const mimeType = url.searchParams.get("mimeType");
  const size = Number(url.searchParams.get("size") ?? NaN);
  try {
    validateMediaUpload({ mimeType, size });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid upload." },
      { status: 400 },
    );
  }

  return NextResponse.json({
    ...getUploadAuthParams(),
    publicKey: env.NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY,
    folder: MEDIA_UPLOAD_FOLDER,
    checks: imageKitUploadChecks(),
  });
}
