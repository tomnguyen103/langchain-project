"use client";

import type { Platform } from "@/db/schema";
import { disconnectAccount } from "@/app/(dashboard)/accounts/actions";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

/** Token-free projection of a social account — safe to pass to the client. */
export type AccountView = {
  id: string;
  platform: Platform;
  handle: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  status: string;
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

  return (
    <div className="flex items-center justify-between rounded-xl border p-4">
      <div className="flex min-w-0 items-center gap-3">
        <Avatar>
          {account.avatarUrl ? (
            <AvatarImage src={account.avatarUrl} alt={name} />
          ) : null}
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <div className="truncate font-medium">{name}</div>
          <div className="mt-0.5 flex items-center gap-2">
            <Badge variant="secondary">{platformLabels[account.platform]}</Badge>
            {account.status !== "active" && (
              <Badge variant="destructive">{account.status}</Badge>
            )}
          </div>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {account.status !== "active" && account.platform !== "discord" && (
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
