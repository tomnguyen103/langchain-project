"use client";

import { useState, useTransition } from "react";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

import {
  createRuleAction,
  type RuleFormInput,
} from "@/app/(dashboard)/auto-reply/actions";
import type { MatchType } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

export type ScopeOption = { value: string; label: string };

const MATCH_LABELS: Record<MatchType, string> = {
  any: "Any keyword",
  all: "All keywords",
  exact: "Exact match",
  regex: "Regex",
};

export function RuleForm({ scopeOptions }: { scopeOptions: ScopeOption[] }) {
  const [scope, setScope] = useState(scopeOptions[0]?.value ?? "");
  const [keywords, setKeywords] = useState("");
  const [matchType, setMatchType] = useState<MatchType>("any");
  const [replyTemplate, setReplyTemplate] = useState("");
  const [useAi, setUseAi] = useState(false);
  const [cooldownSec, setCooldownSec] = useState("0");
  const [maxPerDay, setMaxPerDay] = useState("");
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!scope) {
      toast.error("Choose where this rule applies.");
      return;
    }
    const input: RuleFormInput = {
      scope,
      keywords,
      matchType,
      replyTemplate,
      useAi,
      cooldownSec: Number(cooldownSec) || 0,
      maxPerDay: maxPerDay.trim() === "" ? null : Number(maxPerDay),
    };
    startTransition(async () => {
      try {
        await createRuleAction(input);
        setKeywords("");
        setReplyTemplate("");
        setMaxPerDay("");
        setCooldownSec("0");
        setUseAi(false);
        toast.success("Rule created.");
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to create rule.",
        );
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">New auto-reply rule</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="rule-scope">Applies to</Label>
              <Select value={scope} onValueChange={setScope}>
                <SelectTrigger id="rule-scope">
                  <SelectValue placeholder="Choose account" />
                </SelectTrigger>
                <SelectContent>
                  {scopeOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rule-match">Match</Label>
              <Select
                value={matchType}
                onValueChange={(v) => setMatchType(v as MatchType)}
              >
                <SelectTrigger id="rule-match">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(MATCH_LABELS) as MatchType[]).map((m) => (
                    <SelectItem key={m} value={m}>
                      {MATCH_LABELS[m]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="keywords">Keywords</Label>
            <Input
              id="keywords"
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              placeholder="price, how much, discount"
              disabled={pending}
            />
            <p className="text-muted-foreground text-xs">
              Comma-separated. With Regex, each keyword is a pattern.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="reply">Reply</Label>
            <Textarea
              id="reply"
              value={replyTemplate}
              onChange={(e) => setReplyTemplate(e.target.value)}
              placeholder="Thanks {{author}}! DM us for details 💬"
              rows={3}
              disabled={pending}
            />
            <p className="text-muted-foreground text-xs">
              Use {"{{author}}"} for the commenter&apos;s name.{" "}
              {useAi ? "AI uses this as voice guidance." : ""}
            </p>
          </div>

          <div className="flex flex-wrap items-end gap-4">
            <div className="flex items-center gap-2">
              <Switch id="useAi" checked={useAi} onCheckedChange={setUseAi} />
              <Label htmlFor="useAi">AI-composed reply</Label>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cooldown">Cooldown (sec)</Label>
              <Input
                id="cooldown"
                type="number"
                min={0}
                className="w-28"
                value={cooldownSec}
                onChange={(e) => setCooldownSec(e.target.value)}
                disabled={pending}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="maxPerDay">Max / day</Label>
              <Input
                id="maxPerDay"
                type="number"
                min={1}
                className="w-28"
                value={maxPerDay}
                onChange={(e) => setMaxPerDay(e.target.value)}
                placeholder="∞"
                disabled={pending}
              />
            </div>
            <Button
              type="submit"
              disabled={pending || !scope}
              className="ml-auto"
            >
              {pending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Plus className="size-4" />
              )}
              Add rule
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
