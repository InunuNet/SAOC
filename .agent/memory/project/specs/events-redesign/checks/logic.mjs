// events-redesign pure logic (EV-2, EV-4, EV-5, EV-6 + the date-only query fix). Runs the real lib/events-list.ts and lib/sast-date.ts under Node type stripping.
// Contract (goldens/ev-spec.md section 3): lib/events-list.ts exports EVENT_CONTROLS_MIN, showEventControls, isNationalShowEvent, splitListed,
// groupByMonth, eventDateBlock, listSectionVisible, kindOptions.
import { existsSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { repoRoot } from './_lib.mjs';

const failures = [];
let checks = 0;
const check = (name, ok, detail = '') => { checks += 1; if (!ok) failures.push(`${name} ${detail}`.trim()); };

const listFile = path.join(repoRoot, 'lib/events-list.ts');
if (!existsSync(listFile)) {
  console.error('FAIL: logic.mjs\n  - lib/events-list.ts does not exist');
  process.exit(1);
}
const L = await import(pathToFileURL(listFile).href);
const S = await import(pathToFileURL(path.join(repoRoot, 'lib/sast-date.ts')).href);
for (const name of ['EVENT_CONTROLS_MIN', 'showEventControls', 'isNationalShowEvent', 'splitListed', 'groupByMonth', 'eventDateBlock', 'listSectionVisible', 'kindOptions']) {
  check(`export ${name}`, name in L, 'missing from lib/events-list.ts');
}
if (failures.length) { console.error(`FAIL: logic.mjs\n${failures.map((f) => `  - ${f}`).join('\n')}`); process.exit(1); }

// EV-5: controls only with >= 6 listed upcoming events.
check('EVENT_CONTROLS_MIN is 6', L.EVENT_CONTROLS_MIN === 6, `got ${L.EVENT_CONTROLS_MIN}`);
check('0 events: no controls', L.showEventControls(0) === false);
check('5 events: no controls', L.showEventControls(5) === false);
check('6 events: controls', L.showEventControls(6) === true);
check('17 events: controls', L.showEventControls(17) === true);

// EV-2/EV-4: the featured event is the National Show; it never appears in the list.
const show = { _id: 's', title: '19th South African National Orchid Show', slug: '19th-south-african-national-orchid-show', date: '2027-09-23', endDate: '2027-09-26', kind: 'Show' };
const flagged = { _id: 'f', title: 'Some Flagged Event', slug: 'flagged', date: '2026-11-01', isFeatured: true };
const plain = { _id: 'p', title: 'Cape Orchid Society Winter Show', slug: 'cape', date: '2026-11-07', kind: 'Show' };
const plain2 = { _id: 'q', title: 'Judging Workshop', slug: 'jw', date: '2026-12-05', kind: 'Workshop' };
check('national show title detected', L.isNationalShowEvent(show) === true);
check('ordinary event is not the national show', L.isNationalShowEvent(plain) === false);
const split = L.splitListed([plain, show, flagged, plain2]);
check('splitListed returns featured and rest', Array.isArray(split.featured) && Array.isArray(split.rest));
check('national show and isFeatured rows are not in rest', !split.rest.some((e) => e._id === 's' || e._id === 'f'), JSON.stringify(split.rest.map((e) => e._id)));
check('rest keeps the other rows in order', split.rest.map((e) => e._id).join() === 'p,q', JSON.stringify(split.rest.map((e) => e._id)));
check('featured holds the national show', split.featured.some((e) => e._id === 's'));
const onlyShow = L.splitListed([show]);
check('only the show listed: rest is empty', onlyShow.rest.length === 0);

// EV-6: with nothing left to list, the list section is omitted entirely.
check('list section hidden at 0 rows', L.listSectionVisible(0) === false);
check('list section shown at 1 row', L.listSectionVisible(1) === true);

// EV-4: month grouping, ascending, labelled in the South African calendar (an instant at 00:30 SAST on 1 Nov is November).
const g = L.groupByMonth([
  { _id: 'a', date: '2026-10-31T22:30:00.000Z' },
  { _id: 'b', date: '2026-11-07' },
  { _id: 'c', date: '2026-12-05T08:00:00+02:00' },
  { _id: 'd', date: '2027-01-09' },
]);
check('groupByMonth labels', g.map((x) => x.month).join('|') === 'November 2026|December 2026|January 2027', g.map((x) => x.month).join('|'));
check('groupByMonth keys', g.map((x) => x.key).join() === '2026-11,2026-12,2027-01', g.map((x) => x.key).join());
check('00:30 SAST on 1 Nov lands in November with its sibling', g[0].events.map((e) => e._id).join() === 'a,b', g[0].events.map((e) => e._id).join());
check('empty input gives no groups', L.groupByMonth([]).length === 0);

// EV-4: the date block (day, MON, year); a multi-day event shows a day range.
const one = L.eventDateBlock('2026-11-07', null);
check('date block single day', one.d === '7' && one.m === 'NOV' && one.y === '2026', JSON.stringify(one));
const multi = L.eventDateBlock('2027-09-23', '2027-09-26');
check('date block multi day', multi.d === '23–26' && multi.m === 'SEP' && multi.y === '2027', JSON.stringify(multi));
const late = L.eventDateBlock('2026-10-31T22:30:00.000Z', null);
check('date block uses the SAST day', late.d === '1' && late.m === 'NOV', JSON.stringify(late));

// EV-5: kind chips come from the data, de-duplicated, in first-seen order; never invented.
check('kindOptions from data', L.kindOptions([plain, plain2, { _id: 'z', date: '2026-12-06', kind: 'Show' }, { _id: 'y', date: '2026-12-07', kind: null }]).join() === 'Show,Workshop');

// Query fix: a date-only National Show must be upcoming, the params carry the SAST calendar date, and nothing uses now().
const params = S.upcomingEventsParams(new Date('2026-11-10T10:00:00Z'));
check('params carry todayStart and todayDate', Object.keys(params).join() === 'todayStart,todayDate', Object.keys(params).join());
check('todayDate is the SAST calendar date', params.todayDate === '2026-11-10', String(params.todayDate));
check('date-only show 2027-09-26 is upcoming on 2026-10-25', S.isUpcoming({ date: '2027-09-23', endDate: '2027-09-26' }, new Date('2026-10-25T10:00:00Z')));

// Per-society upcoming query shares the same date-only hole (a society hosting the National Show vanished from its own page): same filter, same param.
import { readFileSync } from 'node:fs';
const qsrc = readFileSync(path.join(repoRoot, 'sanity/queries.ts'), 'utf8');
const sq = (qsrc.match(/export const societyUpcomingEventsQuery = defineQuery\(`([\s\S]*?)`\);/) ?? [])[1] ?? '';
check('societyUpcomingEventsQuery found', sq.length > 0);
check('per-society query keeps the dateTime filter', /dateTime\(coalesce\(endDate, date\)\) >= dateTime\(\$todayStart\)/.test(sq));
check('per-society query admits a date-only last day', /!defined\(dateTime\(coalesce\(endDate, date\)\)\)\s*&&\s*coalesce\(endDate, date\) >= \$todayDate/.test(sq));
check('per-society query keeps the host filter', /hostSociety->slug\.current == \$slug/.test(sq));
const leak = readFileSync(path.join(repoRoot, 'scripts/checks/societies-hidden-leak.mjs'), 'utf8');
check('societies-hidden-leak passes todayDate to upcomingEventsQuery', /todayStart:[^}]*todayDate:/.test(leak));

if (failures.length) { console.error(`FAIL: logic.mjs (${checks} checks)`); for (const f of failures) console.error(`  - ${f}`); process.exit(1); }
console.log(`PASS: logic.mjs, ${checks} checks.`);
