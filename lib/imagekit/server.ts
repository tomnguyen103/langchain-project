import { createHmac, randomUUID } from "node:crypto";

import { env } from "@/lib/env";

/**
 * ImageKit client-side upload authentication parameters.
 * signature = HMAC-SHA1(token + expire) keyed by the private key.
 */
export function getUploadAuthParams() {
  const token = randomUUID();
  const expire = Math.floor(Date.now() / 1000) + 10 * 60; // 10 minutes
  const signature = createHmac("sha1", env.IMAGEKIT_PRIVATE_KEY)
    .update(token + expire)
    .digest("hex");
  return { token, expire, signature };
}
