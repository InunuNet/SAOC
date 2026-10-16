#!/usr/bin/env node
// F19-A4 (R79 #3): the home events strip no longer promises "Upcoming society shows" over a list that holds only the national
// show. Ruling (goldens/f19/f19-spec.md section 2, R3): the existing "What's on" label becomes the strip's h2 and the eyebrow pill
// above it is removed (one "What's on", not two); no new label. The section carries data-home-section="events"; the "Full
// calendar" link, the rows or the empty state, and the section's place in the page order are unchanged.
// Usage: BASE_URL=http://localhost:3619 node contracts/checks/launch-weekend/f19/check-d-events-heading.mjs
import { VIEWPORTS, launch, newPage, open, report } from './_lib.mjs';

const problems = [];
const browser = await launch();
for (const vp of VIEWPORTS) {
  const { ctx, page } = await newPage(browser, vp);
  await open(page, '/');
  const s = page.locator('section[data-home-section="events"]');
  if ((await s.count()) !== 1) { problems.push(`${vp.name}: expected one section[data-home-section="events"], found ${await s.count()}`); await ctx.close(); continue; }
  const info = await s.evaluate((el) => {
    const norm = (t) => t.replace(/[’‘]/g, "'").replace(/\s+/g, ' ').trim();
    const secs = [...document.querySelectorAll('main > section')];
    return { h2: [...el.querySelectorAll('h2')].map((h) => norm(h.textContent)), eyebrows: [...el.querySelectorAll('.eyebrow')].map((e) => norm(e.textContent)),
      calendar: !!el.querySelector('a[href="/events"]'), text: norm(el.textContent), index: secs.indexOf(el),
      before: secs[secs.indexOf(el) - 1]?.getAttribute('data-home-section'), after: secs[secs.indexOf(el) + 1]?.getAttribute('data-home-section') };
  });
  if (info.h2.length !== 1 || info.h2[0] !== "What's on") problems.push(`${vp.name}: events h2 is ${JSON.stringify(info.h2)}, want ["What's on"]`);
  if (info.eyebrows.some((e) => e === "What's on")) problems.push(`${vp.name}: "What's on" still appears as an eyebrow pill beside the h2`);
  if (/Upcoming society shows/i.test(info.text)) problems.push(`${vp.name}: "Upcoming society shows" is still rendered`);
  if (!info.calendar) problems.push(`${vp.name}: the "Full calendar" link to /events is gone`);
  if (info.before !== 'show-band' || info.after !== 'yearbook') problems.push(`${vp.name}: section order changed (before ${info.before}, after ${info.after}; want show-band, yearbook)`);
  await ctx.close();
}
await browser.close();
report(problems, 'events strip is headed "What\'s on" (no duplicate eyebrow, no society-shows promise), calendar link and order intact');
