// Offline checks for event-submit-validation. Usage: tsx check.mjs <case>. SAOC_ROOT overrides the repo root.
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.env.SAOC_ROOT ?? process.cwd();
const guard = await import(pathToFileURL(join(root, 'lib/event-submission-guard.ts')).href);
const NOW = new Date('2026-10-26T08:00:00Z');
const base = {
  title: 'Spring Orchid Show', kind: 'show', date: '2027-12-01', venue: 'Town Hall',
  location: 'Cape Town', description: 'A twenty plus character description.',
};
const fail = (msg) => { console.error(`FAIL ${msg}`); process.exit(1); };
const verdict = (patch) => guard.validateEventSubmission({ ...base, ...patch }, NOW);

const cases = {
  'date-strict-reject'() {
    for (const date of ['December 1 2027', '2027-12-01T10:00:00Z', '2027/12/01', '2027-2-30', '2027-02-30', '2027-13-01', '12/01/2027']) {
      const v = verdict({ date });
      if (v.ok || v.field !== 'date') fail(`date ${JSON.stringify(date)} must be rejected on field date, got ${JSON.stringify(v)}`);
    }
  },
  'enddate-strict-reject'() {
    for (const endDate of ['Dec 5 2027', '2027-12-05T10:00:00Z', '2027-02-30']) {
      const v = verdict({ endDate });
      if (v.ok || v.field !== 'endDate') fail(`endDate ${JSON.stringify(endDate)} must be rejected on field endDate, got ${JSON.stringify(v)}`);
    }
  },
  'guard-valid-accepted'() {
    for (const patch of [{}, { endDate: '2027-12-05' }, { endDate: '2027-12-01' }, { endDate: '' }]) {
      const v = verdict(patch);
      if (!v.ok) fail(`valid ${JSON.stringify(patch)} rejected: ${JSON.stringify(v)}`);
    }
    if (verdict({ date: '2026-10-25' }).ok) fail('past date accepted');
    if (verdict({ endDate: '2027-11-30' }).ok) fail('endDate before date accepted');
  },
  'slug-unique'() {
    if (typeof guard.buildEventSlug !== 'function') fail('lib/event-submission-guard.ts must export buildEventSlug');
    const a = guard.buildEventSlug('Spring Orchid Show!', '2027-12-01', 'drafts.societyEvent-11111111-aaaa-4bbb-8ccc-222222222222');
    const b = guard.buildEventSlug('Spring Orchid Show!', '2027-12-01', 'drafts.societyEvent-33333333-aaaa-4bbb-8ccc-444444444444');
    if (a === b) fail(`same title+date must give distinct slugs for distinct drafts, both ${a}`);
    for (const s of [a, b]) {
      if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(s)) fail(`slug not URL-safe: ${JSON.stringify(s)}`);
      if (!s.startsWith('spring-orchid-show-2027-12-01-')) fail(`slug must keep title-date prefix: ${s}`);
    }
    if (a !== guard.buildEventSlug('Spring Orchid Show!', '2027-12-01', 'drafts.societyEvent-11111111-aaaa-4bbb-8ccc-222222222222')) fail('slug must be deterministic for the same draft id');
  },
};

const name = process.argv[2];
if (!cases[name]) fail(`unknown case ${name}`);
await cases[name]();
console.log(`ok ${name}`);
