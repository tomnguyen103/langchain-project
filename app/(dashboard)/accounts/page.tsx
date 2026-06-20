import { requireUserId } from "@/lib/clerk";
import { listSocialAccounts } from "@/lib/repos/accounts";
import {
  AccountCard,
  type AccountView,
} from "@/components/accounts/account-card";
import { ConnectMetaButton } from "@/components/accounts/connect-meta-button";
import { OAuthResultToast } from "@/components/accounts/oauth-result-toast";

export default async function AccountsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const userId = await requireUserId();
  const [accounts, sp] = await Promise.all([
    listSocialAccounts(userId),
    searchParams,
  ]);
  const firstValue = (v: string | string[] | undefined) =>
    Array.isArray(v) ? v[0] : v;

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
      <OAuthResultToast
        connected={firstValue(sp.connected)}
        error={firstValue(sp.error)}
      />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Connected accounts
          </h1>
          <p className="text-muted-foreground mt-1">
            Connect the platforms you want to publish to.
          </p>
        </div>
        {views.length > 0 && <ConnectMetaButton />}
      </div>

      {views.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed p-12 text-center">
          <p className="font-medium">No accounts connected yet</p>
          <p className="text-muted-foreground mt-1 text-sm">
            Connect Facebook &amp; Instagram to start publishing. Instagram needs
            a Business/Creator account linked to a Facebook Page.
          </p>
          <div className="mt-5 flex justify-center">
            <ConnectMetaButton />
          </div>
        </div>
      ) : (
        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          {views.map((view) => (
            <AccountCard key={view.id} account={view} />
          ))}
        </div>
      )}
    </div>
  );
}
