import { requireUserId } from "@/lib/clerk";
import { evaluateAccountHealth } from "@/lib/accounts/health";
import { listSocialAccounts } from "@/lib/repos/accounts";
import type { AccountView } from "@/components/accounts/account-card";
import { Composer } from "@/components/composer/composer";

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
      <h1 className="text-2xl font-semibold tracking-tight">Create</h1>
      <p className="text-muted-foreground mt-1">
        Compose a post, pick platforms, and schedule it.
      </p>
      <div className="mt-6">
        <Composer accounts={views} initialTopic={sp.topic} />
      </div>
    </div>
  );
}
