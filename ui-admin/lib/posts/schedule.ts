/**
 * Converts a `datetime-local` input value (which has no timezone of its own —
 * the browser gives us wall-clock time in the user's local offset) into an
 * ISO 8601 instant suitable for the API's `scheduledAt` field. The offset is
 * captured by letting `Date` parse the value as local time before
 * serializing; the API only needs the correct instant, not the literal
 * offset digits.
 */
export function datetimeLocalToIso(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

/** True when `isoValue` parses to a valid instant strictly after `now`. */
export function isStrictlyFuture(isoValue: string | null, now: Date = new Date()): boolean {
  if (!isoValue) return false;
  const date = new Date(isoValue);
  if (Number.isNaN(date.getTime())) return false;
  return date.getTime() > now.getTime();
}
