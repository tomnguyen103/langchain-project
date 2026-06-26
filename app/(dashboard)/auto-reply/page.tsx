import Link from "next/link";

import type { CommentEvent, CommentEventStatus, SocialAccount } from "@/db/schema";
import { getPlanLimits } from "@/lib/billing/entitlements";
import { requireUserId } from "@/lib/clerk";
import { PLATFORM_META } from "@/lib/platforms/constants";
import { getConnector, hasConnector } from "@/lib/platforms/registry";
import { listSocialAccounts } from "@/lib/repos/accounts";
import {
  listReplyCopilotInbox,
  type ReplyCopilotInboxItem,
} from "@/lib/repos/reply-copilot";
import {
  listEscalatedCommentsForUser,
  listRecentCommentEventsForUser,
  listRules,
} from "@/lib/repos/replies";
import { RuleForm, type ScopeOption } from "@/components/auto-reply/rule-form";
import { RuleTable, type RuleView } from "@/components/auto-reply/rule-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  dismissReplyCopilotDraftAction,
  prepareReplyCopilotDraftsAction,
  saveReplyCopilotDraftAction,
  sendReplyCopilotDraftAction,
} from "./actions";

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

  const [events, escalations, copilotItems] = await Promise.all([
    listRecentCommentEventsForUser(userId),
    listEscalatedCommentsForUser(userId),
    listReplyCopilotInbox(userId),
  ]);
  const openCopilotItems = copilotItems.filter(
    (item) =>
      !item.draft ||
      (item.draft.status !== "sent" && item.draft.status !== "dismissed"),
  );

  return (
    <div className="space-y-6">
      <Heading />
      <Tabs defaultValue="rules">
        <TabsList>
          <TabsTrigger value="rules">Rules</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="escalations">
            Escalations
            {escalations.length > 0 && (
              <span className="bg-destructive text-destructive-foreground ml-1.5 rounded-full px-1.5 py-0.5 text-xs font-medium">
                {escalations.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="copilot">
            Copilot
            {openCopilotItems.length > 0 && (
              <span className="bg-secondary text-secondary-foreground ml-1.5 rounded-full px-1.5 py-0.5 text-xs font-medium">
                {openCopilotItems.length}
              </span>
            )}
          </TabsTrigger>
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
                <CommentRow key={e.id} event={e} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="escalations">
          <div className="mb-3">
            <p className="text-muted-foreground text-sm">
              Comments classified as <strong>abuse</strong>,{" "}
              <strong>complaint</strong>, or <strong>lead</strong> that need a
              human decision. Auto-reply is blocked for abuse and complaint —
              reply manually from the originating platform.
            </p>
          </div>
          {escalations.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No escalated comments yet. When the triage classifier detects
              abuse, complaints, or leads they appear here.
            </p>
          ) : (
            <div className="space-y-2">
              {escalations.map((e) => (
                <CommentRow key={e.id} event={e} showUrgency />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="copilot" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-muted-foreground text-sm">
              Draft-first replies for leads and questions. Abuse and complaints
              are held for manual review in the source platform.
            </p>
            <form action={prepareReplyCopilotDraftsAction}>
              <Button type="submit" size="sm">
                Prepare suggestions
              </Button>
            </form>
          </div>
          {copilotItems.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No Copilot-eligible comments yet.
            </p>
          ) : (
            <div className="space-y-3">
              {copilotItems.map((item) => (
                <CopilotRow key={item.comment.id} item={item} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function CommentRow({
  event: e,
  showUrgency = false,
}: {
  event: CommentEvent;
  showUrgency?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border p-3">
      <div className="min-w-0">
        <div className="text-sm font-medium">{e.author || "Someone"}</div>
        <div className="text-muted-foreground truncate text-sm">
          {e.text || "No text"}
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
        {e.intent ? (
          <Badge variant={intentVariant[e.intent] ?? "outline"}>
            {e.intent}
          </Badge>
        ) : null}
        {showUrgency && e.urgency && e.urgency !== "low" ? (
          <Badge variant={e.urgency === "high" ? "destructive" : "secondary"}>
            {e.urgency}
          </Badge>
        ) : null}
        <Badge variant={statusVariant[e.status]}>{e.status}</Badge>
      </div>
    </div>
  );
}

function CopilotRow({ item }: { item: ReplyCopilotInboxItem }) {
  const { comment, draft, account } = item;
  const draftText = draft?.editedText ?? draft?.suggestedText ?? "";
  const closed =
    draft?.status === "sent" ||
    draft?.status === "dismissed" ||
    draft?.status === "blocked";

  return (
    <div className="space-y-3 rounded-lg border p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">
              {comment.author || "Someone"}
            </span>
            <Badge variant="outline">{PLATFORM_META[account.platform].label}</Badge>
            {comment.intent ? (
              <Badge variant={intentVariant[comment.intent] ?? "outline"}>
                {comment.intent}
              </Badge>
            ) : null}
          </div>
          <p className="text-muted-foreground text-sm">{comment.text || "No text"}</p>
        </div>
        <Badge variant={draft?.status === "blocked" ? "destructive" : "secondary"}>
          {draft?.status ?? "needs draft"}
        </Badge>
      </div>

      {draft ? (
        <form className="space-y-2">
          <input type="hidden" name="draftId" value={draft.id} />
          <Textarea
            name="text"
            defaultValue={draftText}
            rows={3}
            disabled={draft.status === "sent" || draft.status === "dismissed"}
          />
          <div className="flex flex-wrap justify-end gap-2">
            {draft.status !== "sent" && draft.status !== "dismissed" ? (
              <>
                <Button
                  type="submit"
                  size="sm"
                  variant="outline"
                  formAction={saveReplyCopilotDraftAction}
                >
                  Save
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  variant="outline"
                  formAction={dismissReplyCopilotDraftAction}
                >
                  Dismiss
                </Button>
              </>
            ) : null}
            {!closed ? (
              <Button
                type="submit"
                size="sm"
                formAction={sendReplyCopilotDraftAction}
              >
                Send reply
              </Button>
            ) : null}
          </div>
        </form>
      ) : (
        <p className="text-muted-foreground text-sm">
          No suggestion prepared yet. Use Prepare suggestions to create a draft.
        </p>
      )}
    </div>
  );
}
