/**
 * Shared schedule-time helpers used by every scheduling entry point (composer,
 * post-detail reschedule, calendar drag-reschedule) so client and server agree
 * on what "in the future" means and how a datetime-local value is formatted.
 */

/**
 * Grace window (ms) tolerated when checking that a scheduled time is in the
 * future. Absorbs small client/server clock skew so a legitimate "publish ~now"
 * is not rejected. Mirrors enqueuePublish's `delay = max(0, runAt - now)`.
 */
export const SCHEDULE_GRACE_MS = 60_000;

/** Coerce a Date | ISO string into a Date (no validation). */
function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

/**
 * Format a Date as the local `YYYY-MM-DDTHH:mm` string a `datetime-local`
 * input expects. Uses the runtime's local timezone (matches how the inputs are
 * displayed to the user).
 */
export function toDatetimeLocalValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * Client-side, non-throwing check: is `value` an acceptable future time?
 * Returns false for unparseable values. Used to block submission with a toast
 * before hitting the server.
 */
export function isFutureDate(value: Date | string, now: Date = new Date()): boolean {
  const date = toDate(value);
  if (Number.isNaN(date.getTime())) return false;
  return date.getTime() >= now.getTime() - SCHEDULE_GRACE_MS;
}

/**
 * Server-side guard: assert `value` parses and is not in the past (beyond the
 * grace window). Throws a user-facing Error otherwise; returns the parsed Date
 * so callers can use it directly. This is the authoritative boundary — the
 * client checks are UX only.
 */
export function assertFutureDate(value: Date | string, now: Date = new Date()): Date {
  const date = toDate(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Choose a valid date and time.");
  }
  if (date.getTime() < now.getTime() - SCHEDULE_GRACE_MS) {
    throw new Error("Choose a time in the future.");
  }
  return date;
}
