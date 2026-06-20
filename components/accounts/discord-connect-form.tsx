"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { connectDiscordWebhook } from "@/app/(dashboard)/accounts/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function DiscordConnectForm() {
  const [url, setUrl] = useState("");
  const [pending, startTransition] = useTransition();

  function submit() {
    if (!url.trim()) {
      toast.error("Paste a Discord webhook URL.");
      return;
    }
    const fd = new FormData();
    fd.set("webhookUrl", url.trim());
    startTransition(async () => {
      try {
        await connectDiscordWebhook(fd);
        setUrl("");
        toast.success("Discord webhook connected.");
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to connect Discord.",
        );
      }
    });
  }

  return (
    <div className="flex flex-wrap items-end gap-2 rounded-lg border p-3">
      <div className="min-w-0 flex-1 space-y-1.5">
        <label htmlFor="discord-webhook" className="text-sm font-medium">
          Connect Discord via webhook
        </label>
        <Input
          id="discord-webhook"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
          placeholder="https://discord.com/api/webhooks/…"
          disabled={pending}
        />
      </div>
      <Button onClick={submit} disabled={pending} variant="outline">
        {pending ? <Loader2 className="size-4 animate-spin" /> : null}
        Connect
      </Button>
    </div>
  );
}
