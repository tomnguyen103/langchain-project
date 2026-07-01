import { lookup } from "node:dns/promises";

import ipaddr from "ipaddr.js";

type PublicAddress = { address: string; family: 4 | 6 };

export type AllowedWebhookDestination = {
  url: URL;
  addresses: PublicAddress[];
};

/**
 * Classify a literal IP (v4 or v6) as private/non-routable via ipaddr.js
 * rather than hand-rolled prefix checks. `process()` collapses IPv4-mapped,
 * IPv4-compatible, and NAT64 IPv6 forms (e.g. `::ffff:169.254.169.254`) down
 * to the address they actually route to, so a private/link-local/loopback
 * IPv4 target can't be smuggled through an IPv6 wrapper past a naive prefix
 * check. This is allowlist-based (only plain "unicast" passes) rather than
 * denylist-based, so an exotic or unrecognized range (6to4, Teredo, reserved,
 * carrier-grade NAT, ...) fails closed instead of silently passing through.
 */
function isPrivateIp(literal: string): boolean {
  return ipaddr.process(literal).range() !== "unicast";
}

export function isPrivateHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase().replace(/^\[(.*)\]$/, "$1");
  if (
    normalized === "localhost" ||
    normalized.endsWith(".localhost") ||
    normalized.endsWith(".local")
  ) {
    return true;
  }
  if (!ipaddr.isValid(normalized)) return false;
  return isPrivateIp(normalized);
}

export function isAllowedWebhookUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return false;
    if (url.username || url.password) return false;
    return !isPrivateHostname(url.hostname);
  } catch {
    return false;
  }
}

export async function assertAllowedWebhookDestination(
  value: string,
): Promise<AllowedWebhookDestination> {
  if (!isAllowedWebhookUrl(value)) {
    throw new Error("Webhook URL must be an HTTPS public endpoint.");
  }

  const url = new URL(value);
  const records = await lookup(url.hostname, { all: true, verbatim: true });
  if (records.length === 0) {
    throw new Error("Webhook host could not be resolved.");
  }
  if (records.some((record) => isPrivateHostname(record.address))) {
    throw new Error("Webhook host resolved to a private address.");
  }
  return {
    url,
    addresses: records
      .filter(
        (record): record is PublicAddress =>
          record.family === 4 || record.family === 6,
      )
      .map((record) => ({
        address: record.address,
        family: record.family,
      })),
  };
}
