/**
 * Timezone-aware date utilities for the Asia/Kolkata business timezone.
 * These do NOT rely on the device's local timezone setting.
 */

const KOLKATA_TZ = 'Asia/Kolkata';

/**
 * Returns the current date in Asia/Kolkata as a YYYY-MM-DD string.
 */
export function getKolkataDateString(date: Date = new Date()): string {
  return date.toLocaleDateString('en-CA', { timeZone: KOLKATA_TZ });
}

/**
 * Returns the start and end of the current Kolkata day as UTC ISO strings,
 * suitable for Supabase range queries on timestamptz columns.
 */
export function getKolkataDayBounds(date: Date = new Date()): { start: string; end: string } {
  const kolkataDateStr = getKolkataDateString(date);
  // Kolkata is UTC+5:30. Day starts at 00:00 IST = 18:30 UTC previous day.
  const startUtc = new Date(`${kolkataDateStr}T00:00:00+05:30`).toISOString();
  const endUtc = new Date(`${kolkataDateStr}T23:59:59.999+05:30`).toISOString();
  return { start: startUtc, end: endUtc };
}

/**
 * Formats an ISO timestamp for display in Asia/Kolkata time.
 * e.g. "9:45 AM"
 */
export function formatTimeInKolkata(isoTimestamp: string): string {
  const date = new Date(isoTimestamp);
  return date.toLocaleTimeString('en-IN', {
    timeZone: KOLKATA_TZ,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Formats a date string (YYYY-MM-DD) as a readable heading.
 * e.g. "13 October 2026"
 */
export function formatDateHeading(dateStr: string): string {
  // Parse as a plain date (no timezone shift)
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/**
 * Formats an ISO timestamp as a full date+time in Kolkata timezone.
 * e.g. "13 Oct 2026, 9:45 AM"
 */
export function formatDateTimeInKolkata(isoTimestamp: string): string {
  const date = new Date(isoTimestamp);
  return date.toLocaleDateString('en-IN', {
    timeZone: KOLKATA_TZ,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }) + ', ' + formatTimeInKolkata(isoTimestamp);
}
