import Link from "next/link";

import { requireUserId } from "@/lib/clerk";
import { formatOrgPolicyRules } from "@/lib/compliance/org-policy";
import {
  getBrandProfile,
  getDisclosurePolicy,
} from "@/lib/repos/brand-profiles";

import { BrandProfileForm } from "./brand-profile-form";
import { DisclosurePolicyForm } from "./disclosure-policy-form";

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
