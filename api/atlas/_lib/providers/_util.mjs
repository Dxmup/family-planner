// Small helpers shared by the cash-fare providers when normalizing itineraries into
// the shape the decision layer expects.

// A departure between 21:00 and 05:00 local is a red-eye — the thing you least want
// with two kids in tow, and something scoring.js prices explicitly.
// Accepts an ISO timestamp or an "HH:MM"-bearing string; returns false when unknown
// rather than guessing, so a missing time never fabricates a penalty.
export function isRedEye(when) {
  if (!when) return false;
  const m = /(?:^|[T\s])(\d{1,2}):(\d{2})/.exec(String(when));
  if (!m) return false;
  const hour = Number(m[1]);
  if (!Number.isFinite(hour)) return false;
  return hour >= 21 || hour < 5;
}
