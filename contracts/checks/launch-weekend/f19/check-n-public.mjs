#!/usr/bin/env node
// F19-A21 (vote 1C, public build): every unsourced fact is WITHHELD on the public build (SITE_PUBLIC_LAUNCH=true, PUBLIC_URL, default
// http://localhost:3620). tokens.json provenance.unsourced lists each string that Lee-Ann's Drive does not source (invented editor, ISSN,
// 184 pages, yearbook, federated, 1990, 21 societies, 56 judges, shows hosted, scoring and thresholds, TBC committee, the "partners behind
// SAOC" claim). On home, about, judging, sponsors, media-kit, events, contact and members, the text of <main> holds 0 hits for each, and no
// leaf is a bare 18, 21, 56 or 184. The mechanism is withholdPlaceholderProse() (the F18a switch). Structure: the yearbook band is absent;
// /about shows no committee h3 and exactly one [data-content-gap] with the existing ABSENT sentence; /sponsors is headed "Sponsors" (not
// the untrue partners claim) with the same designed empty state and no stat row; /contact lists only sourced mailboxes; /judging keeps
// its h1 and states the gap once; no route overflows at 390 or 1280. Sourced facts (1968, the Bloemfontein founding meeting, info@saoc.co.za) may stay.
// Usage: PUBLIC_URL=http://localhost:3620 node contracts/checks/launch-weekend/f19/check-n-public.mjs
import { VIEWPORTS, PUBLIC_BASE, launch, newPage, open, report, loadGolden } from './_lib.mjs';

const T = loadGolden('tokens.json').provenance;
const problems = [];
const browser = await launch();
const { ctx, page } = await newPage(browser, VIEWPORTS[1]);
for (const r of T.routes) {
  await open(page, r, PUBLIC_BASE);
  const m = await page.evaluate(() => {
    const main = document.querySelector('main');
    const leaves = []; const w = document.createTreeWalker(main, NodeFilter.SHOW_TEXT);
    while (w.nextNode()) { const t = w.currentNode.textContent.replace(/\s+/g, ' ').trim(); if (t) leaves.push(t); }
    return { text: main.innerText, leaves, h1: [...main.querySelectorAll('h1')].map((h) => h.textContent.trim()),
      gaps: [...main.querySelectorAll('[data-content-gap]')].map((g) => g.textContent.replace(/\s+/g, ' ').trim()), placeholders: main.querySelectorAll('[data-placeholder]').length,
      h3: [...main.querySelectorAll('h3')].map((h) => h.textContent.trim()), yearbook: main.querySelectorAll('[data-home-section="yearbook"]').length,
      mailto: [...main.querySelectorAll('a[href^="mailto:"]')].map((a) => a.getAttribute('href').replace('mailto:', '').toLowerCase()),
      stats: main.querySelectorAll('dl').length, overflow: document.documentElement.scrollWidth > innerWidth + 1 };
  });
  for (const u of T.unsourced) {
    if (u.routes && !u.routes.includes(r)) continue;
    if (u.exceptRoutes && u.exceptRoutes.includes(r)) continue;
    const hit = new RegExp(u.re, u.flags || '').exec(m.text);
    if (hit) problems.push(`${r}: unsourced "${hit[0]}" (${u.id}: ${u.why}) is visible in the public build`);
  }
  for (const n of T.numericLeaves) if (m.leaves.includes(n)) problems.push(`${r}: bare figure "${n}" is a text leaf in the public build`);
  if (!m.h1.length) problems.push(`${r}: no h1`);
  if (m.overflow) problems.push(`${r}: horizontal overflow at 1280`);
  if (r === '/') if (m.yearbook) problems.push('/: the yearbook band is still rendered (every fact in it is unsourced)');
  if (r === '/about') {
    if (m.h3.some((t) => t === 'To be confirmed')) problems.push('/about: committee placeholder h3s are visible');
    if (m.placeholders) problems.push(`/about: ${m.placeholders} [data-placeholder] element(s) in public`);
    if (m.gaps.length !== 1 || !m.gaps[0].includes(T.absentSentence)) problems.push(`/about: want exactly one [data-content-gap] holding the ABSENT sentence, got ${JSON.stringify(m.gaps)}`);
  }
  if (r === '/sponsors') {
    if (m.h1.length !== 1 || m.h1[0] !== 'Sponsors') problems.push(`/sponsors: h1 is ${JSON.stringify(m.h1)}, want ["Sponsors"]`);
    if (!m.gaps.some((g) => g.includes(T.absentSentence))) problems.push('/sponsors: no designed empty state with the ABSENT sentence ([data-content-gap])');
    if (m.stats) problems.push(`/sponsors: ${m.stats} stat list(s) (dl) still rendered`);
  }
  if (r === '/judging' && m.gaps.length !== 1) problems.push(`/judging: want the gap stated exactly once, got ${m.gaps.length}`);
  if (r === '/contact') for (const e of m.mailto) if (!loadGolden('tokens.json').provenance.allowedEmails.includes(e)) problems.push(`/contact: mailto ${e} is not a sourced mailbox`);
}
await ctx.close();
{
  const { ctx: c2, page: p2 } = await newPage(browser, VIEWPORTS[0]);
  for (const r of T.routes) { await open(p2, r, PUBLIC_BASE); if (await p2.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)) problems.push(`${r}: horizontal overflow at 390`); }
  await c2.close();
}
await browser.close();
report(problems, `no unsourced fact is visible on ${T.routes.length} public routes; about, sponsors, judging and contact hold their designed gaps`);
