import { requireUserId } from "@/lib/clerk";
import { evaluateAccountHealth } from "@/lib/accounts/health";
import { listSocialAccounts } from "@/lib/repos/accounts";
import type { AccountView } from "@/components/accounts/account-card";
import { Composer } from "@/components/composer/composer";
import { PageHeader } from "@/components/shared/page-header";

export default async function CreatePage({
  searchParams,
}: {
  searchParams: Promise<{ topic?: string }>;
}) {
  const userId = await requireUserId();
  const [accounts, sp] = await Promise.all([
    listSocialAccounts(userId),
    searchParams,
  ]);
  const now = new Date();
  const views: AccountView[] = accounts.map((a) => {
    const health = evaluateAccountHealth(a, now);
    return {
      id: a.id,
      platform: a.platform,
      handle: a.handle,
      displayName: a.displayName,
      avatarUrl: a.avatarUrl,
      status: a.status,
      healthStatus: health.status,
      healthMessages: health.issues.map((issue) => issue.message),
    };
  });

  return (
    <div>
      <PageHeader
        eyebrow="Workspace"
        title="Create"
        description="Compose a post, pick platforms, and schedule it."
      />
      <div className="mt-6">
        <Composer accounts={views} initialTopic={sp.topic} />
      </div>
    </div>
  );
}
