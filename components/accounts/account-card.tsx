"use client";

import type { Platform } from "@/db/schema";
import { disconnectAccount } from "@/app/(dashboard)/accounts/actions";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { AccountHealthStatus } from "@/lib/accounts/health";

/** Token-free projection of a social account — safe to pass to the client. */
export type AccountView = {
  id: string;
  platform: Platform;
  handle: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  status: string;
  healthStatus: AccountHealthStatus;
  healthMessages: string[];
};

const platformLabels: Record<Platform, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  youtube: "YouTube",
  tiktok: "TikTok",
  linkedin: "LinkedIn",
  pinterest: "Pinterest",
  discord: "Discord",
  x: "X",
};

export function AccountCard({ account }: { account: AccountView }) {
  const name = account.displayName ?? account.handle ?? "Account";
  const initials = name.slice(0, 2).toUpperCase();
  const healthVariant =
    account.healthStatus === "critical"
      ? "destructive"
      : account.healthStatus === "warning"
        ? "outline"
        : "secondary";
  const reconnectable =
    account.platform !== "discord" &&
    (account.healthStatus === "critical" ||
      account.healthStatus === "warning" ||
      ["expired", "revoked"].includes(account.status));

  return (
    <div className="flex items-start justify-between gap-3 rounded-xl border p-4">
      <div className="flex min-w-0 items-center gap-3">
        <Avatar>
          {account.avatarUrl ? (
            <AvatarImage src={account.avatarUrl} alt={name} />
          ) : null}
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <div className="truncate font-medium">{name}</div>
          <div className="mt-0.5 flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{platformLabels[account.platform]}</Badge>
            <Badge variant={healthVariant}>{account.healthStatus}</Badge>
          </div>
          {account.healthMessages.length > 0 && (
            <ul className="text-muted-foreground mt-2 space-y-1 text-xs">
              {account.healthMessages.slice(0, 2).map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {reconnectable && (
          <Button asChild size="sm" variant="outline">
            <a href={`/api/oauth/${account.platform}/start`}>Reconnect</a>
          </Button>
        )}
        <form action={disconnectAccount}>
          <input type="hidden" name="id" value={account.id} />
          <Button type="submit" variant="ghost" size="sm">
            Disconnect
          </Button>
        </form>
      </div>
    </div>
  );
}
