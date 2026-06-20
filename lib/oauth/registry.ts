import type { OAuthProvider } from "@/lib/platforms/types";

import { linkedinProvider } from "./providers/linkedin";
import { metaProvider } from "./providers/meta";

type ProviderEntry = { id: string; label: string; provider: OAuthProvider };

const entries: ProviderEntry[] = [
  { id: "meta", label: "Facebook & Instagram", provider: metaProvider },
  { id: "linkedin", label: "LinkedIn", provider: linkedinProvider },
];

export function getProvider(id: string): OAuthProvider | undefined {
  return entries.find((e) => e.id === id)?.provider;
}

/** Providers whose credentials are configured — used to render connect buttons. */
export function listConnectableProviders(): Array<{
  id: string;
  label: string;
}> {
  return entries
    .filter((e) => e.provider.isConfigured?.() ?? true)
    .map(({ id, label }) => ({ id, label }));
}
