// When is a trip "over"? Pure helpers used by the trip view (read-only lock)
// and the Home list ("Past trips"). Nothing here is persisted: a trip's status
// is derived from its dates every time, so the rule can change freely.
//
//   end date   = startDate + days (startDate is "YYYY-MM-DD" from the wizard)
//   fallback   = createdAt + days + 30 days when there is no start date — a
//                trip created five weeks ago with no date is safely in the past,
//                while one being packed for a departure weeks away is not
//   past       = end date + LOCK_AFTER_DAYS (7) is behind `now`
const DAY = 24 * 60 * 60 * 1000;
export const LOCK_AFTER_DAYS = 7;
const NO_DATE_GRACE_DAYS = 30;

function parseDay(s) {
  // Local-time midnight of a YYYY-MM-DD string; null when absent / malformed.
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || ""));
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** The trip's last day (a Date at local midnight), or null if it can't be known. */
export function tripEndDate(trip) {
  const days = Math.max(1, Number(trip?.days) || 1);
  const start = parseDay(trip?.startDate);
  if (start) return new Date(start.getTime() + (days - 1) * DAY);
  const created = trip?.createdAt ? new Date(trip.createdAt) : null;
  if (!created || Number.isNaN(created.getTime())) return null;
  return new Date(created.getTime() + (days - 1 + NO_DATE_GRACE_DAYS) * DAY);
}

/** True once the trip has been over for LOCK_AFTER_DAYS or more. */
export function isPastTrip(trip, now = new Date()) {
  const end = tripEndDate(trip);
  if (!end) return false;
  return now.getTime() - end.getTime() >= LOCK_AFTER_DAYS * DAY;
}

/** "Ended Aug 20" for the banner / list; "" when the end date isn't known. */
export function endedLabel(trip) {
  const end = tripEndDate(trip);
  if (!end) return "";
  const dated = !!parseDay(trip?.startDate);
  const when = end.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return dated ? `Ended ${when}` : `Created ${new Date(trip.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
}
