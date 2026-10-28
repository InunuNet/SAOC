// =============================================================
// SAOC — lib/fixture-clock.ts
// The pinned "today" for Sanity fixture replay. The upcoming-events queries are keyed by the SAST day,
// so a replay against fixtures recorded on one day misses every day after it. Under
// SANITY_FIXTURE_MODE=replay the fixture directory's _clock.json fixes the default clock to the
// recording day. Imports nothing: scripts load lib/sast-date.ts under Node native type stripping.
// =============================================================

const CLOCK_FILE = '_clock.json';
const cache = new Map<string, Date | null>();

const INSTANT = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/;
const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const MAX_HOUR = 23;
const MAX_MINUTE_OR_SECOND = 59;

// Date silently normalises impossible dates (02-30 becomes 03-02), so the written fields are checked first.
// Plain arithmetic, not Date.UTC: Next's prerender replaces the global Date and drops its statics.
function daysInMonth(year: number, month: number): number {
  const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  return month === 2 ? (leap ? 29 : 28) : DAYS_IN_MONTH[month - 1];
}

// An ISO 8601 instant must carry an offset: a bare local time would pin a different instant per host.
function parseInstant(text: string): Date | null {
  const m = INSTANT.exec(text);
  if (!m) return null;
  const [year, month, day, hour, minute] = [m[1], m[2], m[3], m[4], m[5]].map(Number);
  const second = Number(m[6] ?? 0);
  const calendarOk = month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(year, month);
  const clockOk = hour <= MAX_HOUR && minute <= MAX_MINUTE_OR_SECOND && second <= MAX_MINUTE_OR_SECOND;
  const date = new Date(text);
  return calendarOk && clockOk && !Number.isNaN(date.getTime()) ? date : null;
}

function parseClock(text: string): Date {
  let now: unknown;
  try {
    now = (JSON.parse(text) as { now?: unknown } | null)?.now;
  } catch {
    throw new Error(`${CLOCK_FILE} is not valid JSON`);
  }
  const date = typeof now === 'string' ? parseInstant(now) : null;
  if (!date) {
    throw new Error(`${CLOCK_FILE} must be {"now": "<ISO 8601 instant with an offset>"}`);
  }
  return date;
}

/** The pinned instant under fixture replay, or null (real clock). Never reads the file off replay. */
export function fixtureNow(): Date | null {
  if (process.env.SANITY_FIXTURE_MODE !== 'replay') return null;
  // Same test as isHostedRuntime() in lib/fixture-route-guard.ts, restated because this file imports nothing.
  if (process.env.K_SERVICE) return null;
  const dir = process.env.SANITY_FIXTURE_DIR;
  if (!dir) return null;
  const cached = cache.get(dir);
  if (cached !== undefined) return cached;
  const fs = process.getBuiltinModule('node:fs');
  const path = `${dir}/${CLOCK_FILE}`;
  const pinned = fs.existsSync(path) ? parseClock(fs.readFileSync(path, 'utf8')) : null;
  cache.set(dir, pinned);
  return pinned;
}
