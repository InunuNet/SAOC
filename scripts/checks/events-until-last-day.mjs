// Mission nos-site-split: real events stay listed through their last day, on the South African calendar.
// Runs the real helpers under Node's type stripping and reads the query text; no Sanity access needed.
import { readFileSync } from 'node:fs';

import { isUpcoming, sastStartOfDay, upcomingEventsParams } from '../../lib/sast-date.ts';

let failures = 0;
function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok ? '' : ` ${detail}`}`);
  if (!ok) failures += 1;
}

// A 4-day event: starts 08:00 SAST on 10 Nov 2026 (D), ends 17:00 SAST on 13 Nov (D+3).
const event = { date: '2026-11-10T06:00:00.000Z', endDate: '2026-11-13T15:00:00.000Z' };
const at = (iso) => new Date(iso);
check('listed on D+1', isUpcoming(event, at('2026-11-11T10:00:00Z')));
check('listed on D+3 at 16:00 SAST', isUpcoming(event, at('2026-11-13T14:00:00Z')));
check('listed at 00:30 SAST on D+3', isUpcoming(event, at('2026-11-12T22:30:00Z')));
check('gone on D+4', !isUpcoming(event, at('2026-11-14T10:00:00Z')));
check('gone at 00:30 SAST on D+4', !isUpcoming(event, at('2026-11-13T22:30:00Z')));
const single = { date: '2026-11-10T06:00:00.000Z', endDate: null };
check('a single-day event is listed all day', isUpcoming(single, at('2026-11-10T21:30:00Z')));
check('a single-day event is gone at 00:30 SAST next day', !isUpcoming(single, at('2026-11-10T22:30:00Z')));
check('start of the SAST day for 22:30Z is the next day', sastStartOfDay(at('2026-11-10T22:30:00Z')) === '2026-11-10T22:00:00.000Z');
check('params carry only todayStart', Object.keys(upcomingEventsParams(at('2026-11-10T10:00:00Z'))).join() === 'todayStart');

// Values that are not canonical ".000Z": an offset end, a no-millisecond end, and a date-only last day.
const offset = { date: '2026-11-10T08:00:00+02:00', endDate: '2026-11-13T23:00:00+02:00' };
check('+02:00 end is listed on its last day', isUpcoming(offset, at('2026-11-13T20:00:00Z')));
check('+02:00 end is gone the next day', !isUpcoming(offset, at('2026-11-14T10:00:00Z')));
const noMillis = { date: '2026-11-10T06:00:00Z', endDate: '2026-11-13T15:00:00Z' };
check('no-millisecond end is listed on its last day', isUpcoming(noMillis, at('2026-11-13T14:00:00Z')));
check('no-millisecond end is gone the next day', !isUpcoming(noMillis, at('2026-11-14T10:00:00Z')));
const dateOnly = { date: '2026-11-10', endDate: '2026-11-13' };
check('date-only last day is listed all that SAST day', isUpcoming(dateOnly, at('2026-11-13T21:30:00Z')));
check('date-only last day is gone the next SAST day', !isUpcoming(dateOnly, at('2026-11-13T22:30:00Z')));

const queries = readFileSync('sanity/queries.ts', 'utf8');
check('no upcoming query uses GROQ now()', !queries.includes('now()'));
const FILTER = 'dateTime(coalesce(endDate, date)) >= dateTime($todayStart)';
check('both upcoming queries compare instants with dateTime()', queries.split(FILTER).length - 1 === 2);

process.exit(failures ? 1 : 0);
