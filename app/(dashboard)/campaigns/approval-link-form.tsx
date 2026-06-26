"use client";

import { type FormEvent, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createCampaignApprovalLinkAction } from "./actions";

export function ApprovalLinkForm({ campaignId }: { campaignId: string }) {
  const [email, setEmail] = useState("");
  const [url, setUrl] = useState("");
  const [pending, startTransition] = useTransition();

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      try {
        const result = await createCampaignApprovalLinkAction({
          campaignId,
          email,
        });
        setUrl(result.url);
        toast.success("Approval link created.");
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Could not create link.",
        );
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-2 rounded-lg border p-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="client@example.com"
        />
        <Button type="submit" size="sm" disabled={pending}>
          Create approval link
        </Button>
      </div>
      {url ? <Input value={url} readOnly /> : null}
    </form>
  );
}
