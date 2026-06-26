import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUserId } from "@/lib/clerk";
import { topicsFromLearnedMemory } from "@/lib/brand/learned-notes";
import { formatOrgPolicyRules } from "@/lib/compliance/org-policy";
import {
  getBrandProfile,
  getDisclosurePolicy,
} from "@/lib/repos/brand-profiles";
import type { VoiceHistoryEntry } from "@/db/schema";

import { BrandProfileForm } from "./brand-profile-form";
import { DisclosurePolicyForm } from "./disclosure-policy-form";
import { LearnedMemoryForm } from "./learned-memory-form";

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

export default async function SettingsPage() {
  const userId = await requireUserId();
  const [profile, disclosure] = await Promise.all([
    getBrandProfile(userId),
    getDisclosurePolicy(userId),
  ]);

  return (
    <div className="mx-auto w-full max-w-2xl space-y-10 p-4 sm:p-6">
      <section className="space-y-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Brand safety</h1>
          <p className="text-muted-foreground text-sm">
            Set your brand voice and guardrails. The review agent (Castor) uses
            these to score every draft before it&apos;s scheduled.
          </p>
        </header>
        <BrandProfileForm
          initial={{
            voice: profile.voice,
            bannedTerms: profile.bannedTerms.join(", "),
            policyRules: formatOrgPolicyRules(profile.policyRules),
            autoPublishEnabled: profile.autoPublishEnabled,
            autoPublishThreshold: profile.autoPublishThreshold,
          }}
        />
        <LearnedMemoryCard memory={profile.learnedMemory} />
        <VoiceHistoryCard entries={profile.voiceHistory} />
      </section>

      <section className="space-y-6">
        <header className="space-y-1">
          <h2 className="text-xl font-semibold tracking-tight">
            AI-content disclosure
          </h2>
          <p className="text-muted-foreground text-sm">
            Label AI-generated posts to meet platform and regional rules (e.g. EU
            AI Act Art. 50, CA SB 942). Every labeled post is recorded on your{" "}
            <Link href="/compliance" className="underline">
              compliance ledger
            </Link>
            .
          </p>
        </header>
        <DisclosurePolicyForm
          initial={{
            labelAiContent: disclosure.labelAiContent,
            disclosureText: disclosure.disclosureText ?? "",
            jurisdiction: disclosure.jurisdiction ?? "",
          }}
        />
      </section>
    </div>
  );
}
