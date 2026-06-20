"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";

import { createPost, type SavedMedia } from "@/app/(dashboard)/create/actions";
import type { AccountView } from "@/components/accounts/account-card";
import type { Platform } from "@/db/schema";
import { PLATFORM_META } from "@/lib/platforms/constants";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { MediaUploader } from "./media-uploader";
import { SchedulePicker } from "./schedule-picker";
import { VariantEditor } from "./variant-editor";

function defaultScheduleLocal(): string {
  const d = new Date(Date.now() + 60 * 60 * 1000); // +1h
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

export function Composer({ accounts }: { accounts: AccountView[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>(() =>
    accounts.map((a) => a.id),
  );
  const [bodyByPlatform, setBodyByPlatform] = useState<Record<string, string>>(
    {},
  );
  const [media, setMedia] = useState<SavedMedia[]>([]);
  const [scheduledAt, setScheduledAt] = useState(defaultScheduleLocal());
  const [pending, startTransition] = useTransition();

  const selectedPlatforms = useMemo(() => {
    const set = new Set<Platform>();
    for (const a of accounts) if (selected.includes(a.id)) set.add(a.platform);
    return [...set];
  }, [accounts, selected]);

  if (accounts.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-12 text-center">
        <p className="font-medium">Connect an account first</p>
        <p className="text-muted-foreground mt-1 text-sm">
          You need at least one connected platform before you can publish.
        </p>
        <Button asChild className="mt-5">
          <Link href="/accounts">Go to Accounts</Link>
        </Button>
      </div>
    );
  }

  function toggle(id: string) {
    setSelected((cur) =>
      cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id],
    );
  }

  function setVariant(platform: Platform, body: string) {
    setBodyByPlatform((prev) => ({ ...prev, [platform]: body }));
  }

  function copyToAll(platform: Platform) {
    setBodyByPlatform((prev) => {
      const body = prev[platform] ?? "";
      const next = { ...prev };
      for (const p of selectedPlatforms) next[p] = body;
      return next;
    });
    toast.success("Copied to all platforms.");
  }

  function submit() {
    startTransition(async () => {
      try {
        await createPost({
          bodyByPlatform,
          accountIds: selected,
          mediaIds: media.map((m) => m.id),
          scheduledAt: new Date(scheduledAt).toISOString(),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        });
        toast.success("Post scheduled.");
        router.push("/calendar");
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Could not schedule post.",
        );
      }
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <Card>
          <CardContent className="space-y-3 pt-6">
            <VariantEditor
              platforms={selectedPlatforms}
              value={bodyByPlatform}
              onChange={setVariant}
              onCopyToAll={copyToAll}
            />
            <MediaUploader value={media} onChange={setMedia} />
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <Card>
          <CardContent className="space-y-5 pt-6">
            <div>
              <div className="mb-2 text-sm font-medium">Publish to</div>
              <div className="space-y-2">
                {accounts.map((account) => {
                  const name =
                    account.displayName ?? account.handle ?? "Account";
                  const active = selected.includes(account.id);
                  return (
                    <label
                      key={account.id}
                      className={cn(
                        "flex cursor-pointer items-center gap-3 rounded-lg border p-2.5 text-sm transition-colors",
                        active
                          ? "border-primary bg-accent"
                          : "hover:bg-accent/50",
                      )}
                    >
                      <input
                        type="checkbox"
                        className="accent-primary size-4"
                        checked={active}
                        onChange={() => toggle(account.id)}
                      />
                      <span className="min-w-0 flex-1 truncate">{name}</span>
                      <span className="text-muted-foreground text-xs">
                        {PLATFORM_META[account.platform].label}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>

            <SchedulePicker value={scheduledAt} onChange={setScheduledAt} />

            <Button
              onClick={submit}
              disabled={pending || selected.length === 0}
              className="w-full"
            >
              {pending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Send className="size-4" />
              )}
              Schedule post
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
