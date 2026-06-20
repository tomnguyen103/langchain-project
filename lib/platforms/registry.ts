import type { Platform } from "@/db/schema";

import { facebookConnector } from "./facebook";
import { instagramConnector } from "./instagram";
import type { PlatformConnector } from "./types";

/** Platform → connector. The publish worker resolves connectors polymorphically. */
const connectors: Partial<Record<Platform, PlatformConnector>> = {
  facebook: facebookConnector,
  instagram: instagramConnector,
};

export function getConnector(platform: Platform): PlatformConnector {
  const connector = connectors[platform];
  if (!connector) {
    throw new Error(`No connector registered for platform: ${platform}`);
  }
  return connector;
}

export function hasConnector(platform: Platform): boolean {
  return Boolean(connectors[platform]);
}

export function registeredPlatforms(): Platform[] {
  return Object.keys(connectors) as Platform[];
}
