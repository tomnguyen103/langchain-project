/**
 * Shared scheduling-time validation, used by every entry point that schedules a
 * publish (composer, post-detail reschedule, calendar drag) plus the server
 * actions behind them. Keeping it in one pure module avoids drift between the
 * client guards and the server enforcement.
 */

/**
 * Grace window (ms) tolerated when validating "future" times, so a small clock
 * skew between the user's browser and the server doesn't reject a "publish now".
 */
export const SCHEDULE_GRACE_MS = 60_000;

/** Whether a scheduled time is acceptably in the future (within the grace window). */
export function isFutureSchedule(date: Date, now: Date = new Date()): boolean {
  return date.getTime() >= now.getTime() - SCHEDULE_GRACE_MS;
}

/**
 * Throw a friendly error if a scheduled time is invalid or in the past. Server
 * actions call this as the authoritative guard; clients also pre-check for fast
 * feedback.
 */
export function assertFutureSchedule(date: Date): void {
  if (Number.isNaN(date.getTime())) {
    throw new Error("Choose a valid date and time.");
  }
  if (!isFutureSchedule(date)) {
    throw new Error("Choose a time in the future.");
  }
}

/** Format a Date as a `YYYY-MM-DDTHH:mm` value for a datetime-local input (local tz). */
export function toDateTimeLocal(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
