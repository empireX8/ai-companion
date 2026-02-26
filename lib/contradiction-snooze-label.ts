// Year at-or-above which a snoozedUntil date is treated as "indefinite"
const INDEFINITE_YEAR_THRESHOLD = 2099;

/**
 * Returns the human-readable label for a snoozed contradiction card, or null
 * if the date is absent, invalid, or already expired (the on-read expiry
 * handles expired nodes before they reach the UI).
 *
 * @param until ISO date string from ContradictionListItem.snoozedUntil
 * @param now   Injected for testability; defaults to the current time
 */
export function getSnoozedLabel(until: string | null, now = new Date()): string | null {
  if (!until) return null;

  const d = new Date(until);
  if (Number.isNaN(d.getTime())) return null;

  // Expired snoozes are turned back to "open" server-side on read, so the
  // label for a past date should never appear — return null defensively.
  if (d <= now) return null;

  if (d.getFullYear() >= INDEFINITE_YEAR_THRESHOLD) return "snoozed (indefinite)";

  const days = Math.ceil((d.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
  return `snoozed ~${days}d (until ${d.toISOString().slice(0, 10)})`;
}
