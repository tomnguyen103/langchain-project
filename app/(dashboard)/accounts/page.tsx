import { requireUserId } from "@/lib/clerk";
import { evaluateAccountHealth } from "@/lib/accounts/health";
import { listConnectableProviders } from "@/lib/oauth/registry";
import { listSocialAccounts } from "@/lib/repos/accounts";
import {
  AccountCard,
  type AccountView,
} from "@/components/accounts/account-card";
import { ConnectButton } from "@/components/accounts/connect-button";
import { DiscordConnectForm } from "@/components/accounts/discord-connect-form";
import { OAuthResultToast } from "@/components/accounts/oauth-result-toast";
import { PageHeader } from "@/components/shared/page-header";

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
  const providers = listConnectableProviders();
  const firstValue = (v: string | string[] | undefined) =>
    Array.isArray(v) ? v[0] : v;

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

  const connectButtons = (
    <div className="flex flex-wrap gap-2">
      {providers.map((p) => (
        <ConnectButton key={p.id} id={p.id} label={p.label} />
      ))}
    </div>
  );

  return (
    <div>
      <OAuthResultToast
        connected={firstValue(sp.connected)}
        error={firstValue(sp.error)}
      />

      <PageHeader
        eyebrow="Channels"
        title="Connected accounts"
        description="Connect the platforms you want to publish to."
        actions={views.length > 0 ? connectButtons : undefined}
      />

      <div className="mt-6 max-w-xl">
        <DiscordConnectForm />
      </div>

      {views.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed p-12 text-center">
          <p className="font-medium">No accounts connected yet</p>
          <p className="text-muted-foreground mt-1 text-sm">
            Connect a platform to start publishing. Instagram needs a
            Business/Creator account linked to a Facebook Page.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {providers.map((p) => (
              <ConnectButton key={p.id} id={p.id} label={p.label} />
            ))}
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
