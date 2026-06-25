/**
 * Chronos — best-time-to-post scorer.
 *
 * Pure functions with no DB/env deps so the scoring logic is unit-testable in
 * isolation. The posting_windows repo reads/writes the computed scores; Atlas
 * and the composer call recommendPublishTime() to get a concrete datetime.
 */

export type PostSample = {
  /** When the post was actually published (UTC). */
  publishedAt: Date;
  /** Sum of all numeric metric values (likes + comments + views + shares). */
  engagement: number;
};

export type WindowScore = {
  dayOfWeek: number; // 0 = Sunday … 6 = Saturday (JS Date.getUTCDay())
  hourOfDay: number; // 0–23 UTC
  score: number;     // normalised 0–1 (1 = best slot seen)
  postCount: number;
};

/**
 * Platform-wide prior: weekday 9am–11am UTC (conservative default for when
 * a tenant has fewer than MIN_SAMPLE_SIZE posts to learn from).
 */
const MIN_SAMPLE_SIZE = 5;

const PRIOR_WINDOWS: Array<{ dayOfWeek: number; hourOfDay: number; score: number }> = [
  { dayOfWeek: 1, hourOfDay: 9, score: 0.8 },
  { dayOfWeek: 2, hourOfDay: 9, score: 0.8 },
  { dayOfWeek: 3, hourOfDay: 9, score: 0.9 },
  { dayOfWeek: 4, hourOfDay: 9, score: 0.85 },
  { dayOfWeek: 5, hourOfDay: 9, score: 0.7 },
];

/**
 * Compute per-(dayOfWeek, hourOfDay) engagement scores from historical samples.
 * Scores are normalised so the top slot is 1.0 — making them comparable across
 * tenants with different absolute engagement levels.
 *
 * When fewer than MIN_SAMPLE_SIZE samples are provided the function returns the
 * platform-wide priors, labelled with postCount = 0 so the caller can show
 * a low-confidence label.
 */
export function scoreWindows(samples: PostSample[]): WindowScore[] {
  if (samples.length < MIN_SAMPLE_SIZE) {
    return PRIOR_WINDOWS.map((w) => ({ ...w, postCount: 0 }));
  }

  // Aggregate engagement per (dayOfWeek, hourOfDay) slot.
  const slotMap = new Map<string, { totalEngagement: number; postCount: number }>();
  for (const s of samples) {
    const dow = s.publishedAt.getUTCDay();
    const hour = s.publishedAt.getUTCHours();
    const key = `${dow}:${hour}`;
    const entry = slotMap.get(key) ?? { totalEngagement: 0, postCount: 0 };
    entry.totalEngagement += s.engagement;
    entry.postCount += 1;
    slotMap.set(key, entry);
  }

  // Average engagement per post per slot (so one viral post doesn't dominate).
  const rawScores: Array<{ dayOfWeek: number; hourOfDay: number; avgEngagement: number; postCount: number }> = [];
  for (const [key, { totalEngagement, postCount }] of slotMap.entries()) {
    const [dow, hour] = key.split(":").map(Number);
    rawScores.push({ dayOfWeek: dow, hourOfDay: hour, avgEngagement: totalEngagement / postCount, postCount });
  }

  // Normalise to 0–1.
  const maxAvg = Math.max(...rawScores.map((s) => s.avgEngagement), 1);
  return rawScores
    .map(({ avgEngagement, ...rest }) => ({ ...rest, score: avgEngagement / maxAvg }))
    .sort((a, b) => b.score - a.score);
}

/**
 * Return the next wall-clock datetime (UTC) that falls on the best available
 * (dayOfWeek, hourOfDay) window, starting from `from`. Uses the top-scored
 * window; if the slot is earlier in the current week, picks the equivalent
 * next-week slot.
 */
export function nextBestPublishTime(windows: WindowScore[], from: Date): Date {
  if (windows.length === 0) {
    // Fallback: one hour from now.
    return new Date(from.getTime() + 60 * 60_000);
  }

  const [best] = windows; // already sorted by score desc
  const target = new Date(from);
  target.setUTCHours(best.hourOfDay, 0, 0, 0);

  // Advance to the target day of week.
  const currentDow = from.getUTCDay();
  let deltaDays = best.dayOfWeek - currentDow;
  if (deltaDays < 0) deltaDays += 7;
  // If same day but the hour has passed, schedule next week.
  if (deltaDays === 0 && target.getTime() <= from.getTime()) deltaDays = 7;
  target.setUTCDate(target.getUTCDate() + deltaDays);

  return target;
}

/**
 * Whether there's enough data to give a confident recommendation.
 * When false the caller should show a "based on platform defaults" label.
 */
export function isHighConfidence(windows: WindowScore[]): boolean {
  return windows.some((w) => w.postCount >= MIN_SAMPLE_SIZE);
}
