"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  deleteRuleAction,
  toggleRuleAction,
} from "@/app/(dashboard)/auto-reply/actions";
import type { MatchType } from "@/db/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

export type RuleView = {
  id: string;
  platformLabel: string;
  scopeLabel: string;
  keywords: string[];
  matchType: MatchType;
  replyTemplate: string;
  useAi: boolean;
  enabled: boolean;
  cooldownSec: number;
  maxPerDay: number | null;
};

export function RuleTable({ rules }: { rules: RuleView[] }) {
  if (rules.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        No rules yet. Create one above to start auto-replying to comments.
      </p>
    );
  }
  return (
    <div className="space-y-2">
      {rules.map((rule) => (
        <RuleRow key={rule.id} rule={rule} />
      ))}
    </div>
  );
}

function RuleRow({ rule }: { rule: RuleView }) {
  const [pending, startTransition] = useTransition();

  function toggle(enabled: boolean) {
    startTransition(async () => {
      try {
        await toggleRuleAction(rule.id, enabled);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to update rule.",
        );
      }
    });
  }

  function remove() {
    startTransition(async () => {
      try {
        await deleteRuleAction(rule.id);
        toast.success("Rule deleted.");
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to delete rule.",
        );
      }
    });
  }

  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border p-3">
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{rule.platformLabel}</Badge>
          <span className="text-muted-foreground text-xs">
            {rule.scopeLabel}
          </span>
          {rule.useAi && <Badge variant="secondary">AI</Badge>}
          <Badge variant="secondary">{rule.matchType}</Badge>
        </div>
        <div className="truncate text-sm font-medium">
          {rule.keywords.join(", ") || "—"}
        </div>
        <div className="text-muted-foreground truncate text-xs">
          → {rule.replyTemplate || (rule.useAi ? "AI-composed reply" : "—")}
        </div>
        <div className="text-muted-foreground text-xs">
          Cooldown {rule.cooldownSec}s
          {rule.maxPerDay != null ? ` · max ${rule.maxPerDay}/day` : ""}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <Switch
          checked={rule.enabled}
          onCheckedChange={toggle}
          disabled={pending}
          aria-label="Rule enabled"
        />
        <Button
          variant="ghost"
          size="icon"
          onClick={remove}
          disabled={pending}
          aria-label="Delete rule"
        >
          <Trash2 className="size-4" />
        </Button>
      </div>
    </div>
  );
}
