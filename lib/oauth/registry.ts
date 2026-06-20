import type { OAuthProvider } from "@/lib/platforms/types";

import { metaProvider } from "./providers/meta";

const providers: Record<string, OAuthProvider> = {
  meta: metaProvider,
};

export function getProvider(id: string): OAuthProvider | undefined {
  return providers[id];
}
