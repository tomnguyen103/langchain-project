import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/shared/page-header";
import { requireUserId } from "@/lib/clerk";
import { topicsFromLearnedMemory } from "@/lib/brand/learned-notes";
import { formatOrgPolicyRules } from "@/lib/compliance/org-policy";
import {
  getBrandProfile,
  getDisclosurePolicy,
} from "@/lib/repos/brand-profiles";
import { listIntegrationTokens } from "@/lib/repos/integrations";
import { listWebhookEndpoints } from "@/lib/repos/webhooks";
import type { VoiceHistoryEntry } from "@/db/schema";

import { BrandProfileForm } from "./brand-profile-form";
import { DisclosurePolicyForm } from "./disclosure-policy-form";
import { IntegrationTokensForm } from "./integration-tokens-form";
import { LearnedMemoryForm } from "./learned-memory-form";
import { WebhookEndpointsForm } from "./webhook-endpoints-form";

const TABS = ["brand-safety", "ai-disclosure", "integrations"] as const;
type SettingsTab = (typeof TABS)[number];

function isSettingsTab(value: string | undefined): value is SettingsTab {
  return TABS.includes(value as SettingsTab);
}

function firstValue(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

function LearnedMemoryCard({
  memory,
}: {
  memory: Record<string, unknown> | null;
}) {
  const topics = topicsFromLearnedMemory(memory);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold">
          Learned memory
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-muted-foreground text-sm">
          Themes saved here are passed into the next Lyra generation run.
        </p>
        <LearnedMemoryForm initialTopics={topics} />
      </CardContent>
    </Card>
  );
}

function VoiceHistoryCard({ entries }: { entries: VoiceHistoryEntry[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold">Voice history</CardTitle>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No history yet — save the brand voice to start tracking changes.
          </p>
        ) : (
          <ul className="space-y-3">
            {entries.map((entry, i) => {
              const date = new Date(entry.savedAt);
              const label = date.toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              });
              const truncated =
                entry.voice.length > 120
                  ? entry.voice.slice(0, 120) + "…"
                  : entry.voice;
              return (
                <li key={i} className="space-y-0.5">
                  <p className="text-sm">{truncated}</p>
                  <p className="text-muted-foreground text-xs">
                    Saved · {label}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const userId = await requireUserId();
  const sp = await searchParams;
  const requestedTab = firstValue(sp.tab);
  const defaultTab: SettingsTab = isSettingsTab(requestedTab)
    ? requestedTab
    : "brand-safety";

  const [profile, disclosure, integrationTokens, webhookEndpoints] = await Promise.all([
    getBrandProfile(userId),
    getDisclosurePolicy(userId),
    listIntegrationTokens(userId),
    listWebhookEndpoints(userId),
  ]);

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 p-4 sm:p-6">
      <PageHeader
        eyebrow="Settings"
        title="Settings"
        description="Brand voice and guardrails, AI-content disclosure, and integration access."
      />

      <Tabs defaultValue={defaultTab}>
        <TabsList>
          <TabsTrigger value="brand-safety">Brand safety</TabsTrigger>
          <TabsTrigger value="ai-disclosure">AI disclosure</TabsTrigger>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
        </TabsList>

        <TabsContent value="brand-safety" className="space-y-6">
          <p className="text-muted-foreground text-sm">
            Set your brand voice and guardrails. The review agent (Castor)
            uses these to score every draft before it&apos;s scheduled.
          </p>
          <BrandProfileForm
            initial={{
              voice: profile.voice,
              bannedTerms: profile.bannedTerms.join(", "),
              policyRules: formatOrgPolicyRules(profile.policyRules),
              policyPacks: profile.policyPacks,
              autoPublishEnabled: profile.autoPublishEnabled,
              autoPublishThreshold: profile.autoPublishThreshold,
            }}
          />
          <LearnedMemoryCard memory={profile.learnedMemory} />
          <VoiceHistoryCard entries={profile.voiceHistory} />
        </TabsContent>

        <TabsContent value="ai-disclosure" className="space-y-6">
          <p className="text-muted-foreground text-sm">
            Label AI-generated posts to meet platform and regional rules (e.g.
            EU AI Act Art. 50, CA SB 942). Every labeled post is recorded on
            your{" "}
            <Link href="/governance?tab=compliance" className="underline">
              compliance ledger
            </Link>
            .
          </p>
          <DisclosurePolicyForm
            initial={{
              labelAiContent: disclosure.labelAiContent,
              disclosureText: disclosure.disclosureText ?? "",
              jurisdiction: disclosure.jurisdiction ?? "",
            }}
          />
        </TabsContent>

        <TabsContent value="integrations" className="space-y-6">
          <p className="text-muted-foreground text-sm">
            Scoped A2A bearer tokens and outbound webhooks for external agent
            clients.
          </p>
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">A2A access</CardTitle>
            </CardHeader>
            <CardContent>
              <IntegrationTokensForm
                tokens={integrationTokens.map((token) => ({
                  id: token.id,
                  name: token.name,
                  kind: token.kind,
                  scopes: token.scopes,
                  status: token.status,
                  createdAt: token.createdAt.toISOString(),
                  lastUsedAt: token.lastUsedAt?.toISOString() ?? null,
                }))}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">
                Webhook endpoints
              </CardTitle>
            </CardHeader>
            <CardContent>
              <WebhookEndpointsForm
                endpoints={webhookEndpoints.map((endpoint) => ({
                  id: endpoint.id,
                  name: endpoint.name,
                  url: endpoint.url,
                  eventTypes: endpoint.eventTypes,
                  enabled: endpoint.enabled,
                  lastDeliveredAt:
                    endpoint.lastDeliveredAt?.toISOString() ?? null,
                }))}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
