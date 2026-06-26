import { createHmac, randomBytes } from "node:crypto";

export function generateWebhookSecret(): string {
  return `whsec_${randomBytes(32).toString("base64url")}`;
}

export function signWebhookPayload(input: {
  secret: string;
  timestamp: number;
  body: string;
}): string {
  return createHmac("sha256", input.secret)
    .update(`${input.timestamp}.${input.body}`)
    .digest("hex");
}
