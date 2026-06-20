import { requireUserId } from "@/lib/clerk";
import { listSocialAccounts } from "@/lib/repos/accounts";
import type { AccountView } from "@/components/accounts/account-card";
import { Composer } from "@/components/composer/composer";

export default async function CreatePage() {
  const userId = await requireUserId();
  const accounts = await listSocialAccounts(userId);
  const views: AccountView[] = accounts.map((a) => ({
    id: a.id,
    platform: a.platform,
    handle: a.handle,
    displayName: a.displayName,
    avatarUrl: a.avatarUrl,
    status: a.status,
  }));

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Create</h1>
      <p className="text-muted-foreground mt-1">
        Compose a post, pick platforms, and schedule it.
      </p>
      <div className="mt-6">
        <Composer accounts={views} />
      </div>
    </div>
  );
}
