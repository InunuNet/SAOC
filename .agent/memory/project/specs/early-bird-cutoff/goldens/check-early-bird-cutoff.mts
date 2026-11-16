// early-bird-cutoff: drives the real hub pipeline (buildHubCards -> buildTicketCardViewModels)
// with a fixed clock and proves early-bird availability is decided by earlyBirdCutoff only.
// Compares a deterministic summary with goldens/expected-output.json. Read-only for Hydrogen.
// Run: TSX_TSCONFIG_PATH="${CHECK_ROOT:-.}/tsconfig.json" pnpm exec tsx <this file>
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve(process.env.CHECK_ROOT ?? '.');
const here = resolve('.agent/memory/project/specs/early-bird-cutoff/goldens');
const hub = (await import(pathToFileURL(resolve(root, 'lib/data/ticket-hub-source.ts')).href)) as {
  buildHubCards: (i: Record<string, unknown>) => {
    cards: Record<string, Record<string, unknown> | undefined>;
    pool: unknown;
  };
};

const SHOW = { _ref: 'show-1' };
const base = { show: SHOW, capacityPool: null, headcountPerUnit: 1, releasedQuantity: null };
const types = (cutoff: string | null) => [
  { ...base, name: 'Weekend Pass (Early Bird)', slug: 'weekend-pass-early-bird', price: 360, capacity: 500, capacityPool: 'admission-early-bird', earlyBirdCutoff: cutoff },
  { ...base, name: 'Weekend Pass', slug: 'weekend-pass', price: 380, capacity: 300, earlyBirdCutoff: null },
  { ...base, name: 'Day Visitor (Early Bird)', slug: 'early-bird', price: 120, capacity: 500, capacityPool: 'admission-early-bird', earlyBirdCutoff: cutoff },
  { ...base, name: 'Day Visitor Ticket', slug: 'day-visitor', price: 150, capacity: 1000, earlyBirdCutoff: null },
];
const EXHAUSTED = { 'weekend-pass-early-bird': 300, 'early-bird': 200 }; // the old 500 cap is fully sold
const run = (cutoff: string | null, now: string, soldByType: Record<string, number>) => {
  const out = hub.buildHubCards({
    cmsTypes: types(cutoff),
    salesOpen: true,
    soldByType,
    soldByDay: { 'early-bird': { '2027-09-24': 10 } },
    stockKnown: true,
    now: new Date(now),
    showDays: ['2027-09-24', '2027-09-25', '2027-09-26'],
    activeShowId: 'show-1',
  });
  const pick = (id: string) => {
    const c = out.cards[id];
    return c ? { slug: c.slug, state: c.state, price: c.price, hasCount: c.scarcity !== null && c.scarcity !== undefined } : null;
  };
  return { weekend: pick('weekend'), day: pick('day'), poolBanner: out.pool === null ? 'none' : 'present' };
};

const got = {
  'before cutoff, pool unsold': run('2027-07-31', '2027-07-15T10:00:00Z', {}),
  'before cutoff, old 500 cap fully sold': run('2027-07-31', '2027-07-15T10:00:00Z', EXHAUSTED),
  'last minute of cutoff day (UTC)': run('2027-07-31', '2027-07-31T23:59:00Z', EXHAUSTED),
  'first minute after cutoff day': run('2027-07-31', '2027-08-01T00:00:00Z', {}),
  'null cutoff, far future, 500 sold': run(null, '2030-01-01T00:00:00Z', EXHAUSTED),
};
if (process.env.DUMP) { console.log(JSON.stringify(got, null, 1)); process.exit(0); }
const want = JSON.parse(readFileSync(resolve(here, 'expected-output.json'), 'utf8')) as Record<string, unknown>;
const problems = Object.keys(want).filter((k) => JSON.stringify(got[k as keyof typeof got]) !== JSON.stringify(want[k]));
if (problems.length > 0) {
  for (const k of problems) console.error(`FAIL ${k}\n  want ${JSON.stringify(want[k])}\n  got  ${JSON.stringify(got[k as keyof typeof got])}`);
  process.exit(1);
}
console.log(`early-bird-cutoff: ${Object.keys(want).length} cases match`);
