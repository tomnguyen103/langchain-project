import { requireUserId } from "@/lib/clerk";
import { getBrandProfile } from "@/lib/repos/brand-profiles";

import { BrandProfileForm } from "./brand-profile-form";

export default async function SettingsPage() {
  const userId = await requireUserId();
  const profile = await getBrandProfile(userId);

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 p-4 sm:p-6">
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
          autoPublishEnabled: profile.autoPublishEnabled,
          autoPublishThreshold: profile.autoPublishThreshold,
        }}
      />
    </div>
  );
}
