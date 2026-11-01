/**
 * Date helpers. Dates are stored as local `YYYY-MM-DD` strings so they never shift with time zones.
 * Every function that depends on "now" accepts it as an argument, which keeps them unit-testable.
 */

export const DAY_MS = 86400000;

export const pad = (n: number) => String(n).padStart(2, '0');

export const toISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const todayISO = (now = new Date()) => toISO(now);

export const fromISO = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const addDays = (iso: string, n: number) => {
  const d = fromISO(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
};

/** Whole days from today to `iso` (negative = in the past). */
export const diffDays = (iso: string, now = new Date()) =>
  Math.round((fromISO(iso).getTime() - fromISO(todayISO(now)).getTime()) / DAY_MS);

export const isValidISO = (s: unknown): s is string =>
  typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && toISO(fromISO(s)) === s;

export const fmtDate = (iso: string) =>
  fromISO(iso).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });

export const fmtMonth = (iso: string) =>
  fromISO(iso).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

/** "just now", "5 min ago", "3 h ago", "2 d ago", or a short date. */
export const ago = (ts: number, nowMs = Date.now()) => {
  const s = Math.round((nowMs - ts) / 1000);
  if (s < 60) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d} d ago`;
  return new Date(ts).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
};
