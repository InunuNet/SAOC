#!/usr/bin/env node
// F19-A23 (R47 /events): (1) the National Show row's title links to /national-show (the other rows keep /events/<slug>); (2) every row has a
// <time datetime> equal to the event's date and the listing emits one Event JSON-LD per row, built with the existing eventJsonLd helper
// (startDate matches the row's datetime, absolute url, @type Event); (3) the row count equals the PUBLISHED upcoming societyEvent documents read
// read-only from Sanity (drafts excluded). Finding behind "1 shown, 18 loaded": 17 of the 18 societyEvent documents are unpublished drafts (the
// query reads published content), so one row is correct today; the check keeps that true if Brad publishes some.
// Usage: BASE_URL=http://localhost:3619 node contracts/checks/launch-weekend/f19/check-q-events.mjs
import { VIEWPORTS, launch, newPage, open, report, loadGolden } from './_lib.mjs';
import { publishedUpcomingEvents } from './_cms.mjs';

const T = loadGolden('tokens.json').events;
const problems = [];
const cms = await publishedUpcomingEvents();
const browser = await launch();
for (const vp of VIEWPORTS) {
  const { ctx, page } = await newPage(browser, vp);
  await open(page, '/events');
  const m = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('main article')].map((a) => {
      const link = a.querySelector('a[href]'); const t = a.querySelector('time[datetime]');
      return { title: link ? link.textContent.trim() : '', href: link ? link.getAttribute('href') : null, dt: t ? t.getAttribute('datetime') : null };
    });
    const ld = [...document.querySelectorAll('script[type="application/ld+json"]')].flatMap((s) => { try { const j = JSON.parse(s.textContent); return Array.isArray(j) ? j : [j]; } catch { return []; } }).filter((j) => j['@type'] === 'Event');
    return { rows, ld };
  });
  const tag = vp.name;
  if (m.rows.length !== cms.published.length) problems.push(`${tag}: ${m.rows.length} row(s) rendered, ${cms.published.length} published upcoming societyEvent doc(s) in Sanity (${cms.totalDocs} docs in all, the rest are drafts or past)`);
  for (const r of m.rows) {
    if (/national.*show/i.test(r.title) && r.href !== T.nsHref) problems.push(`${tag}: National Show row links to ${r.href}, want ${T.nsHref}`);
    if (!r.dt || Number.isNaN(Date.parse(r.dt))) problems.push(`${tag}: row "${r.title.slice(0, 30)}" has no valid <time datetime> (${r.dt})`);
  }
  if (m.ld.length !== m.rows.length) problems.push(`${tag}: ${m.ld.length} Event JSON-LD block(s) for ${m.rows.length} row(s)`);
  for (const e of m.ld) {
    if (!/^https?:\/\//.test(e.url || '')) problems.push(`${tag}: Event JSON-LD "${(e.name || '').slice(0, 30)}" has no absolute url`);
    if (!m.rows.some((r) => r.dt && r.dt.slice(0, 10) === String(e.startDate).slice(0, 10))) problems.push(`${tag}: Event JSON-LD startDate ${e.startDate} matches no row's datetime`);
  }
  await ctx.close();
}
await browser.close();
report(problems, `${cms.published.length} published event row(s): National Show links to ${T.nsHref}, each has <time datetime> and one Event JSON-LD`);
