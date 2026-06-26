import type { EvergreenPreference } from "@/db/schema";

export function nextEvergreenRunAt(
  frequency: EvergreenPreference["frequency"],
  from = new Date(),
): Date {
  const next = new Date(from);
  next.setUTCMilliseconds(0);
  next.setUTCSeconds(0);
  next.setUTCMinutes(0);
  next.setUTCHours(10);
  if (frequency === "weekly") {
    next.setUTCDate(next.getUTCDate() + 7);
  } else {
    next.setUTCMonth(next.getUTCMonth() + 1);
  }
  return next;
}

export function isEvergreenDue(
  preference: Pick<EvergreenPreference, "enabled" | "nextRunAt">,
  now = new Date(),
): boolean {
  return preference.enabled && Boolean(preference.nextRunAt && preference.nextRunAt <= now);
}

export function selectEvergreenSource<
  T extends { targetId: string; platform: string; engagementSum: number },
>(
  winners: T[],
  opts: {
    minEngagement: number;
    platforms: string[];
    lastSourceTargetId?: string | null;
  },
): T | undefined {
  return winners.find((winner) => {
    if (winner.engagementSum < opts.minEngagement) return false;
    if (winner.targetId === opts.lastSourceTargetId) return false;
    if (opts.platforms.length > 0 && !opts.platforms.includes(winner.platform)) {
      return false;
    }
    return true;
  });
}
