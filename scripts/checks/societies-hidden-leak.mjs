// societies-content regression: no hidden (listed:false) society may surface through global
// search, event queries, or the client bundle. Run: npx tsx scripts/checks/societies-hidden-leak.mjs
// (the bundle scan runs only when a build exists in .next/static).
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { parse, evaluate } from 'groq-js';

import { matchSocieties } from '@/lib/societies/search';
import {
  societyListQuery,
  upcomingEventsQuery,
  eventBySlugQuery,
} from '@/sanity/queries';

const SPEC = '.agent/memory/project/specs/societies-content/goldens';
const BOX = '.tmp/sandbox/societies-content/leak-check';
mkdirSync(BOX, { recursive: true });
const OUT = `${BOX}/after-apply.json`;

const apply = spawnSync(
  'npx',
  ['tsx', 'scripts/sync-societies-from-drive.ts', '--apply', '--fixture-docs',
    `${SPEC}/fixtures/existing-docs.json`, '--fixture-out', OUT, '--backup-dir', `${BOX}/backup`],
  { encoding: 'utf8' },
);
assert.equal(apply.status, 0, apply.stderr);

const hidden = JSON.parse(readFileSync(`${SPEC}/disposition.json`, 'utf8')).hide;
const store = JSON.parse(readFileSync(OUT, 'utf8'));
const hiddenId = 'society-transvaal-orchid-society';
const listedId = 'society-cape-orchid-society';
const event = (id, slug, host) => ({
  _id: id, _type: 'societyEvent', title: `Event ${slug}`, slug: { current: slug },
  date: '2999-01-01T10:00:00Z', hostSociety: { _type: 'reference', _ref: host },
});
const dataset = [...store, event('e1', 'hidden-host', hiddenId), event('e2', 'listed-host', listedId)];
const run = async (query, params = {}) => (await evaluate(parse(query), { dataset, params })).get();

// 3. global search: fed by the listed-only query, so no hidden name is reachable.
const listed = await run(societyListQuery);
assert.equal(listed.length, 21);
for (const h of hidden) {
  const words = h.name.toLowerCase().split(' ').filter((w) => w.length > 3 && w !== 'orchid' && w !== 'society');
  for (const w of words) {
    const hits = matchSocieties(listed, w).map((s) => s.name);
    assert.ok(!hits.includes(h.name), `search for "${w}" surfaced hidden "${h.name}"`);
  }
}
const overlay = readFileSync('components/chrome/SearchOverlay.tsx', 'utf8');
assert.ok(!/from '@\/lib\/data'|lib\/data\/societies/.test(overlay), 'SearchOverlay reads a hardcoded society list');

// 4. events: a hidden host is projected as null, a listed host is kept.
const upcoming = await run(upcomingEventsQuery, { todayStart: '2000-01-01T00:00:00Z', todayDate: '2000-01-01' });
assert.equal(upcoming.find((e) => e.slug === 'hidden-host').hostSociety, null);
assert.equal(upcoming.find((e) => e.slug === 'listed-host').hostSociety.name, 'Cape Orchid Society');
const detail = await run(eventBySlugQuery, { slug: 'hidden-host' });
assert.equal(detail.hostSociety, null);
assert.ok(!JSON.stringify([upcoming, detail]).includes('Transvaal'), 'hidden society name present in event results');

// Built client bundle: no hidden society name.
function walk(dir) {
  return readdirSync(dir).flatMap((n) => {
    const p = path.join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}
if (existsSync('.next/static')) {
  const files = walk('.next/static').filter((f) => f.endsWith('.js'));
  for (const f of files) {
    const text = readFileSync(f, 'utf8');
    for (const h of hidden) assert.ok(!text.includes(h.name), `${f} contains hidden society "${h.name}"`);
  }
  console.log(`scanned ${files.length} client chunks`);
}
console.log('PASS hidden societies unreachable via search, events and the client bundle');
