#!/usr/bin/env node
// A-I: no copy changes. Every text node of the NavCards, YearbookStrip and PartnersSection sections equals the golden exactly (the decorative aria-hidden arrow glyph is not copy and may be added or dropped). The ShowBand text nodes
// (countdown digits excluded) equal the golden as a multiset, with the single permitted edit "Book Tickets" ->
// "Book tickets" (sentence case, README l.51); the CTA row is reordered by the ruling so order is not compared here
// (check-d asserts it). Placeholder figures ("21 societies", "56 accredited judges") must still be present.
// Usage: BASE_URL=http://localhost:3614 node contracts/checks/launch-weekend/f14/check-i-copy.mjs
import { VIEWPORTS, launch, newPage, openHome, loadGolden, report } from './_lib.mjs';
import { EXTRACT_SRC } from './_sections.mjs';

const golden = loadGolden('copy.json');
const problems = [];
const browser = await launch();
const { ctx, page } = await newPage(browser, VIEWPORTS[1], { reducedMotion: 'reduce' });
await openHome(page);
const x = await page.evaluate(EXTRACT_SRC);
await browser.close();

if (JSON.stringify(x.nav) !== JSON.stringify(golden.nav)) {
  const g = golden.nav, n = x.nav;
  const diff = g.map((t, i) => (n[i] === t ? null : `#${i} "${t}" -> "${n[i]}"`)).filter(Boolean).slice(0, 6);
  problems.push(`NavCards text changed (${n.length} nodes vs ${g.length}): ${diff.join('; ') || 'length differs'}`);
}
const want = golden.band.map((t) => (t === 'Book Tickets' ? 'Book tickets' : t)).sort();
const got = [...x.band].sort();
if (JSON.stringify(want) !== JSON.stringify(got)) {
  const missing = want.filter((t) => !got.includes(t)), extra = got.filter((t) => !want.includes(t));
  problems.push(`ShowBand text changed; missing [${missing.join(' | ')}] extra [${extra.join(' | ')}]`);
}
for (const k of ['yearbook', 'partners']) if (JSON.stringify(x[k].filter((t) => t !== '→')) !== JSON.stringify(golden[k].filter((t) => t !== '→'))) problems.push(`${k} text changed: got ${JSON.stringify(x[k]).slice(0, 160)}`);
if (JSON.stringify(x.partnerLinks) !== JSON.stringify(golden.partnerLinks)) problems.push(`partner links (href|target|rel) changed: ${JSON.stringify(x.partnerLinks)}`);
for (const t of ['21 societies', '56 accredited judges']) if (!x.nav.includes(t)) problems.push(`placeholder figure "${t}" must be left as is`);
report(problems, 'no copy change beyond Book Tickets -> Book tickets; placeholder figures untouched');
