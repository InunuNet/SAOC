// Finding (d): lib/ics.ts emits RFC 5545 all-day events (VALUE=DATE, exclusive DTEND) and leaves timed
// events exactly as they were. Also proves both ICS routes build through lib/ics (neither formats a
// date itself) and that the combined feed handles several events independently.
// Run as: pnpm exec tsx contracts/checks/saoc-seo-polish/check-ics.mts
import { readFileSync } from 'node:fs';

import { buildVCalendar, buildVEvent, escapeIcsText, toIcsDate } from '../../../lib/ics.ts';

const golden = JSON.parse(readFileSync('contracts/golden/saoc-seo-polish/ics-fixtures.json', 'utf8'));
const failures: string[] = [];

const linesOf = (vevent: string) => vevent.split('\r\n').filter((l) => !l.startsWith('DTSTAMP:'));

for (const c of golden.cases) {
  const got = linesOf(buildVEvent(c.input));
  if (JSON.stringify(got) !== JSON.stringify(c.expectedLines)) {
    failures.push(`${c.name}:\n  got      ${JSON.stringify(got)}\n  expected ${JSON.stringify(c.expectedLines)}`);
  }
}

// Combined feed: every fixture appears, in order, each with its own expected lines.
const feed = buildVCalendar(golden.cases.map((c: { input: never }) => c.input));
if (!feed.startsWith('BEGIN:VCALENDAR\r\n') || !feed.endsWith('END:VCALENDAR\r\n')) failures.push('feed envelope changed');
const blocks = feed.split('BEGIN:VEVENT\r\n').slice(1).map((b) => 'BEGIN:VEVENT\r\n' + b.split('END:VEVENT')[0] + 'END:VEVENT');
if (blocks.length !== golden.cases.length) failures.push(`feed has ${blocks.length} VEVENTs, expected ${golden.cases.length}`);
blocks.forEach((b, i) => {
  if (JSON.stringify(linesOf(b)) !== JSON.stringify(golden.cases[i].expectedLines)) failures.push(`feed event ${i} (${golden.cases[i].name}) differs from its standalone output`);
});

// Existing exports keep their behaviour.
if (toIcsDate('2027-09-23T07:00:00Z') !== '20270923T070000Z') failures.push('toIcsDate changed');
if (escapeIcsText('a,b;c\nd') !== 'a\\,b\\;c\\nd') failures.push('escapeIcsText changed');

// Both routes go through lib/ics and none formats a date or a DTEND itself.
for (const f of ['app/api/events.ics/route.ts', 'app/api/events/[slug]/ics/route.ts']) {
  const src = readFileSync(f, 'utf8');
  if (!src.includes('buildVCalendar')) failures.push(`${f}: does not use buildVCalendar`);
  if (/DTEND|DTSTART|toIcsDate/.test(src)) failures.push(`${f}: formats a calendar date itself`);
}

if (failures.length > 0) {
  console.error('FAIL\n' + failures.join('\n'));
  process.exit(1);
}
console.log(`PASS: ${golden.cases.length} ICS cases, feed and both routes`);
