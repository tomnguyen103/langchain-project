import type {
  ResearchWatchFrequency,
  ResearchWatchSourceMode,
  ResearchWatchSourceStatus,
} from "@/db/schema";

export function nextWatchRunAt(
  frequency: ResearchWatchFrequency,
  from = new Date(),
): Date {
  const next = new Date(from);
  next.setUTCMilliseconds(0);
  next.setUTCSeconds(0);
  next.setUTCMinutes(0);
  next.setUTCHours(9);
  next.setUTCDate(next.getUTCDate() + (frequency === "daily" ? 1 : 7));
  return next;
}

export function isWatchDue(
  watch: { status: string; nextRunAt: Date | null },
  now = new Date(),
): boolean {
  return watch.status === "active" && Boolean(watch.nextRunAt && watch.nextRunAt <= now);
}

export function researchSourceStatus(
  mode: ResearchWatchSourceMode,
  tavilyConfigured: boolean,
): ResearchWatchSourceStatus {
  if (mode === "model_only") return "model-only";
  if (mode === "web" && tavilyConfigured) return "web";
  if (mode === "web") return "model-only";
  return tavilyConfigured ? "web" : "model-only";
}

export function watchPeriodKey(frequency: ResearchWatchFrequency, date: Date): string {
  const d = new Date(date);
  if (frequency === "weekly") {
    const day = d.getUTCDay();
    const diff = (day + 6) % 7;
    d.setUTCDate(d.getUTCDate() - diff);
  }
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}
