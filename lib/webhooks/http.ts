import https from "node:https";
import type { LookupFunction } from "node:net";

import type { AllowedWebhookDestination } from "./url";

export type WebhookHttpResponse = {
  ok: boolean;
  status: number;
};

function lockedLookup(destination: AllowedWebhookDestination): LookupFunction {
  return (_hostname, options, callback) => {
    const family =
      typeof options === "object" && options.family === 6
        ? 6
        : typeof options === "object" && options.family === 4
          ? 4
          : undefined;
    const familyMatches = family
      ? destination.addresses.filter((address) => address.family === family)
      : destination.addresses;
    const addresses =
      familyMatches.length > 0 ? familyMatches : destination.addresses;
    if (addresses.length === 0) {
      callback(new Error("Webhook host could not be resolved."), "", 4);
      return;
    }

    if (typeof options === "object" && options.all) {
      callback(
        null,
        addresses.map((record) => ({
          address: record.address,
          family: record.family,
        })),
      );
      return;
    }

    const record = addresses[0];
    callback(null, record.address, record.family);
  };
}

export function postWebhookJson(opts: {
  destination: AllowedWebhookDestination;
  headers: Record<string, string>;
  body: string;
  timeoutMs: number;
}): Promise<WebhookHttpResponse> {
  return new Promise((resolve, reject) => {
    const { destination } = opts;
    let settled = false;

    function resolveOnce(value: WebhookHttpResponse): void {
      if (settled) return;
      settled = true;
      clearTimeout(deadline);
      resolve(value);
    }

    function rejectOnce(error: Error): void {
      if (settled) return;
      settled = true;
      clearTimeout(deadline);
      reject(error);
    }

    const req = https.request(
      {
        protocol: destination.url.protocol,
        hostname: destination.url.hostname,
        port: destination.url.port || 443,
        path: `${destination.url.pathname}${destination.url.search}`,
        method: "POST",
        headers: opts.headers,
        lookup: lockedLookup(destination),
        timeout: opts.timeoutMs,
      },
      (res) => {
        res.resume();
        res.on("aborted", () => {
          rejectOnce(new Error("Webhook response aborted."));
        });
        res.on("error", rejectOnce);
        res.on("end", () => {
          const status = res.statusCode ?? 0;
          resolveOnce({ ok: status >= 200 && status < 300, status });
        });
      },
    );

    const deadline = setTimeout(() => {
      const error = new Error("Webhook request timed out.");
      rejectOnce(error);
      req.destroy(error);
    }, opts.timeoutMs);
    deadline.unref?.();

    req.on("timeout", () => {
      req.destroy(new Error("Webhook request timed out."));
    });
    req.on("error", rejectOnce);
    req.end(opts.body);
  });
}
