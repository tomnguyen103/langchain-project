"use client";

import type { ComponentType } from "react";
import { CircleAlert, ImageIcon, Info } from "lucide-react";
import {
  FaDiscord,
  FaFacebook,
  FaInstagram,
  FaLinkedin,
  FaPinterest,
  FaTiktok,
  FaXTwitter,
  FaYoutube,
} from "react-icons/fa6";

import type { Platform } from "@/db/schema";
import { analyzePreview } from "@/lib/platforms/preview";
import { cn } from "@/lib/utils";

const PLATFORM_ICONS: Record<Platform, ComponentType<{ className?: string }>> = {
  facebook: FaFacebook,
  instagram: FaInstagram,
  linkedin: FaLinkedin,
  x: FaXTwitter,
  youtube: FaYoutube,
  tiktok: FaTiktok,
  pinterest: FaPinterest,
  discord: FaDiscord,
};

/**
 * A platform-native preview of one draft: brand-styled header, the caption
 * rendered the way a follower sees it (with the in-feed "See more" fold), a
 * media slot, and limit/format warnings. Pure render off
 * {@link analyzePreview} — no network, no new data.
 */
export function PlatformPreview({
  platform,
  body,
  mediaCount = 0,
}: {
  platform: Platform;
  body: string;
  mediaCount?: number;
}) {
  const a = analyzePreview(platform, body, mediaCount);
  const Icon = PLATFORM_ICONS[platform];
  const folded = a.foldAt !== null && body.length > a.foldAt;
  const visible = folded ? body.slice(0, a.foldAt as number) : body;
  const hidden = folded ? body.slice(a.foldAt as number) : "";
  const empty = body.trim().length === 0;

  return (
    <div className="bg-card rounded-xl border">
      <div className="flex items-center gap-2 border-b p-3">
        <span className="bg-muted flex size-8 shrink-0 items-center justify-center rounded-full">
          <Icon className="size-4" />
        </span>
        <div className="min-w-0 leading-tight">
          <div className="text-sm font-medium">Your {a.label} account</div>
          <div className="text-muted-foreground text-xs">Native preview</div>
        </div>
        <span
          className={cn(
            "ml-auto text-xs tabular-nums",
            a.overBy > 0 ? "text-destructive" : "text-muted-foreground",
          )}
        >
          {a.charCount.toLocaleString()} / {a.maxLength.toLocaleString()}
        </span>
      </div>

      <div className="space-y-3 p-3">
        {empty ? (
          <p className="text-muted-foreground text-sm italic">
            Nothing to preview yet.
          </p>
        ) : (
          <p className="text-sm break-words whitespace-pre-wrap">
            {visible}
            {folded ? (
              <>
                <span className="text-primary"> …See more</span>
                <span className="text-muted-foreground/50">{hidden}</span>
              </>
            ) : null}
          </p>
        )}

        {mediaCount > 0 ? (
          <div className="text-muted-foreground bg-muted/40 flex aspect-video items-center justify-center gap-2 rounded-lg border border-dashed text-xs">
            <ImageIcon className="size-4" aria-hidden />
            {mediaCount} media attachment{mediaCount === 1 ? "" : "s"}
          </div>
        ) : null}
      </div>

      {a.warnings.length > 0 ? (
        <ul className="space-y-1 border-t p-3 text-xs">
          {a.warnings.map((w, i) => (
            <li
              key={i}
              className={cn(
                "flex items-start gap-1.5",
                w.level === "error" ? "text-destructive" : "text-muted-foreground",
              )}
            >
              {w.level === "error" ? (
                <CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              ) : (
                <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              )}
              <span>{w.message}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
