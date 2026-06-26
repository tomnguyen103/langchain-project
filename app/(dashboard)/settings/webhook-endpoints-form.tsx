"use client";

import { type FormEvent, useState, useTransition } from "react";
import { Webhook } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createWebhookEndpointAction,
  setWebhookEndpointEnabledAction,
} from "./actions";

export type WebhookEndpointView = {
  id: string;
  name: string;
  url: string;
  eventTypes: string[];
  enabled: boolean;
  lastDeliveredAt: string | null;
};

const WEBHOOK_EVENTS = [
  "campaign.created",
  "campaign.source_created",
  "agent.run_started",
];

export function WebhookEndpointsForm({
  endpoints,
}: {
  endpoints: WebhookEndpointView[];
}) {
  const [name, setName] = useState("Campaign webhook");
  const [url, setUrl] = useState("");
  const [eventTypes, setEventTypes] = useState<string[]>(WEBHOOK_EVENTS);
  const [secret, setSecret] = useState("");
  const [pending, startTransition] = useTransition();

  function toggleEvent(eventType: string, checked: boolean) {
    setEventTypes((current) =>
      checked
        ? current.includes(eventType)
          ? current
          : [...current, eventType]
        : current.filter((item) => item !== eventType),
    );
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      try {
        const result = await createWebhookEndpointAction({
          name,
          url,
          eventTypes,
        });
        setSecret(result.secret);
        toast.success("Webhook endpoint created.");
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Could not create webhook.",
        );
      }
    });
  }

  function setEnabled(id: string, enabled: boolean) {
    startTransition(async () => {
      try {
        await setWebhookEndpointEnabledAction(id, enabled);
        toast.success(enabled ? "Webhook enabled." : "Webhook disabled.");
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Could not update webhook.",
        );
      }
    });
  }

  return (
    <div className="space-y-5">
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <div className="space-y-2">
            <Label htmlFor="webhook-name">Name</Label>
            <Input
              id="webhook-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={80}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="webhook-url">URL</Label>
            <Input
              id="webhook-url"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://example.com/webhooks/socialflow"
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {WEBHOOK_EVENTS.map((eventType) => (
            <label
              key={eventType}
              className="inline-flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs"
            >
              <input
                type="checkbox"
                className="h-3.5 w-3.5 accent-primary"
                checked={eventTypes.includes(eventType)}
                onChange={(event) => toggleEvent(eventType, event.target.checked)}
              />
              {eventType}
            </label>
          ))}
        </div>
        <Button type="submit" disabled={pending}>
          <Webhook className="size-4" aria-hidden />
          Create webhook
        </Button>
      </form>

      {secret ? (
        <div className="space-y-2 rounded-lg border p-3">
          <p className="text-sm font-medium">Signing secret</p>
          <Input value={secret} readOnly />
          <p className="text-muted-foreground text-xs">
            This value is shown once.
          </p>
        </div>
      ) : null}

      <div className="space-y-2">
        {endpoints.length === 0 ? (
          <p className="text-muted-foreground text-sm">No webhook endpoints.</p>
        ) : (
          endpoints.map((endpoint) => (
            <div
              key={endpoint.id}
              className="flex flex-wrap items-center gap-2 rounded-lg border p-3 text-sm"
            >
              <span className="min-w-0 flex-1 font-medium">
                {endpoint.name}
                <span className="text-muted-foreground mt-0.5 block truncate text-xs font-normal">
                  {endpoint.url}
                </span>
              </span>
              <Badge variant={endpoint.enabled ? "default" : "outline"}>
                {endpoint.enabled ? "enabled" : "disabled"}
              </Badge>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() => setEnabled(endpoint.id, !endpoint.enabled)}
              >
                {endpoint.enabled ? "Disable" : "Enable"}
              </Button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
