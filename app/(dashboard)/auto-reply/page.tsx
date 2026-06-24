import Link from "next/link";

import type { CommentEventStatus, SocialAccount } from "@/db/schema";
import { getPlanLimits } from "@/lib/billing/entitlements";
import { requireUserId } from "@/lib/clerk";
import { PLATFORM_META } from "@/lib/platforms/constants";
import { getConnector, hasConnector } from "@/lib/platforms/registry";
import { listSocialAccounts } from "@/lib/repos/accounts";
import {
  listRecentCommentEventsForUser,
  listRules,
} from "@/lib/repos/replies";
import { RuleForm, type ScopeOption } from "@/components/auto-reply/rule-form";
import { RuleTable, type RuleView } from "@/components/auto-reply/rule-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const accountName = (a: SocialAccount) =>
  a.displayName ?? a.handle ?? a.platformAccountId;

const statusVariant: Record<
  CommentEventStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  pending: "secondary",
  matched: "secondary",
  replying: "secondary",
  replied: "default",
  skipped: "outline",
  failed: "destructive",
};

// Heuristic triage intent (Sirius+): escalate-worthy buckets stand out so a human
// can spot leads/complaints/abuse in the feed at a glance.
const intentVariant: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  abuse: "destructive",
  complaint: "destructive",
  lead: "default",
  question: "secondary",
  praise: "secondary",
  spam: "outline",
  other: "outline",
};

function Heading() {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Auto-reply</h1>
      <p className="text-muted-foreground mt-1">
        Reply to comments automatically by keyword, templated or AI-composed.
      </p>
    </div>
  );
}

function Notice({
  title,
  body,
  cta,
}: {
  title: string;
  body: string;
  cta: { href: string; label: string };
}) {
  return (
    <Card>
      <CardContent className="py-10 text-center">
        <p className="font-medium">{title}</p>
        <p className="text-muted-foreground mx-auto mt-1 max-w-md text-sm">
          {body}
        </p>
        <Button asChild className="mt-4">
          <Link href={cta.href}>{cta.label}</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

export default async function AutoReplyPage() {
  const userId = await requireUserId();
  const [limits, rules, accounts] = await Promise.all([
    getPlanLimits(),
    listRules(userId),
    listSocialAccounts(userId),
  ]);

  if (!limits.autoReply) {
    return (
      <div className="space-y-6">
        <Heading />
        <Notice
          title="Auto-reply is a Pro feature"
          body="Upgrade your plan to reply to comments automatically by keyword or with AI."
          cta={{ href: "/billing", label: "View plans" }}
        />
      </div>
    );
  }

  const commentAccounts = accounts.filter(
    (a) =>
      hasConnector(a.platform) &&
      getConnector(a.platform).capabilities.supportsComments,
  );

  if (commentAccounts.length === 0) {
    return (
      <div className="space-y-6">
        <Heading />
        <Notice
          title="No comment-capable accounts"
          body="Connect a Facebook or Instagram account to start auto-replying to comments."
          cta={{ href: "/accounts", label: "Connect an account" }}
        />
      </div>
    );
  }

  const platforms = [...new Set(commentAccounts.map((a) => a.platform))];
  const scopeOptions: ScopeOption[] = [
    ...platforms.map((p) => ({
      value: `platform:${p}`,
      label: `All ${PLATFORM_META[p].label} accounts`,
    })),
    ...commentAccounts.map((a) => ({
      value: `account:${a.id}`,
      label: `${PLATFORM_META[a.platform].label} · ${accountName(a)}`,
    })),
  ];

  const accountLabels = new Map(
    commentAccounts.map((a) => [a.id, accountName(a)]),
  );
  const ruleViews: RuleView[] = rules.map((r) => ({
    id: r.id,
    platformLabel: PLATFORM_META[r.platform].label,
    scopeLabel: r.socialAccountId
      ? (accountLabels.get(r.socialAccountId) ?? "1 account")
      : "All accounts",
    keywords: r.keywords,
    matchType: r.matchType,
    replyTemplate: r.replyTemplate,
    useAi: r.useAi,
    enabled: r.enabled,
    cooldownSec: r.cooldownSec,
    maxPerDay: r.maxPerDay,
  }));

  const events = await listRecentCommentEventsForUser(userId);

  return (
    <div className="space-y-6">
      <Heading />
      <Tabs defaultValue="rules">
        <TabsList>
          <TabsTrigger value="rules">Rules</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="rules" className="space-y-4">
          <RuleForm scopeOptions={scopeOptions} />
          <RuleTable rules={ruleViews} />
        </TabsContent>

        <TabsContent value="activity">
          {events.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No comments ingested yet. Once your published posts get comments,
              matches and replies show up here.
            </p>
          ) : (
            <div className="space-y-2">
              {events.map((e) => (
                <div
                  key={e.id}
                  className="flex items-start justify-between gap-4 rounded-lg border p-3"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium">
                      {e.author || "Someone"}
                    </div>
                    <div className="text-muted-foreground truncate text-sm">
                      {e.text || "No text"}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {e.intent ? (
                      <Badge variant={intentVariant[e.intent] ?? "outline"}>
                        {e.intent}
                      </Badge>
                    ) : null}
                    <Badge variant={statusVariant[e.status]}>{e.status}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
