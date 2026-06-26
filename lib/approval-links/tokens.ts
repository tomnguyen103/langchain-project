import { randomBytes } from "node:crypto";

import { hashIntegrationToken } from "@/lib/integrations/tokens";

export function generateApprovalToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashIntegrationToken(token) };
}
