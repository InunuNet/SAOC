// Mission nos-site-split: the invented-events "upcoming" boundary is the South African calendar day.
// Runs the real module under Node's type stripping; no build needed.
import { upcomingPlaceholderEvents } from '../../lib/data/placeholder-events.ts';
import { sastDate } from '../../lib/sast-date.ts';

let failures = 0;
function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok ? '' : ` ${detail}`}`);
  if (!ok) failures += 1;
}

check('2026-10-22T23:30Z is already the 23rd in SAST', sastDate(new Date('2026-10-22T23:30:00Z')) === '2026-10-23');
check('2026-10-22T21:30Z is still the 22nd in SAST', sastDate(new Date('2026-10-22T21:30:00Z')) === '2026-10-22');
const lastNight = upcomingPlaceholderEvents(new Date('2027-03-06T23:30:00Z')).map((e) => e.date);
check('a single-day event on 2027-03-06 is gone at 00:30 SAST on the 7th', !lastNight.includes('2027-03-06'), lastNight.join());
const sameDay = upcomingPlaceholderEvents(new Date('2027-03-06T21:30:00Z')).map((e) => e.date);
check('the same event is still up at 23:30 SAST on the 6th', sameDay.includes('2027-03-06'), sameDay.join());

process.exit(failures ? 1 : 0);
