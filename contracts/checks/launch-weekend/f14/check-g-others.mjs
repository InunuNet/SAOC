#!/usr/bin/env node
// A-G: every OTHER home section is byte-identical to the golden captured from untouched origin/main (e9f7d4f9): hero,
// mission, events strip, yearbook strip, partners and any non-section node in <main>. Compared as sha256 of the
// normalised outerHTML (useId churn stripped), under reduced motion so the hero carousel is static.
// Usage: BASE_URL=http://localhost:3614 node contracts/checks/launch-weekend/f14/check-g-others.mjs
import { createHash } from 'node:crypto';
import { VIEWPORTS, launch, newPage, openHome, loadGolden, report } from './_lib.mjs';
import { EXTRACT_SRC } from './_sections.mjs';

// F19 RE-PIN (spec/lw-f19): F19 owns the home hero, mission and events strip (scrim, type, heading, axis container), so those three golden
// sections (keys 0:, 1:, 4:) are no longer byte-pinned; the non-section nodes stay pinned.
const F19_OWNED = [/^0:/, /^1:/, /^4:/];
const golden = loadGolden('other-sections.json');
for (const k of Object.keys(golden.sections)) if (F19_OWNED.some((re) => re.test(k))) delete golden.sections[k];
const problems = [];
const browser = await launch();
const { ctx, page } = await newPage(browser, VIEWPORTS[1], { reducedMotion: 'reduce' });
await openHome(page);
const x = await page.evaluate(EXTRACT_SRC);
await browser.close();
const got = Object.fromEntries(Object.entries(x.others).map(([k, v]) => [k, createHash('sha256').update(v).digest('hex')]));
for (const k of Object.keys(golden.sections)) if (!(k in got)) problems.push(`section "${k}" is missing or was renamed/reordered`);
for (const k of Object.keys(got)) if (!(k in golden.sections) && !F19_OWNED.some((re) => re.test(k))) problems.push(`unexpected extra section "${k}"`);
for (const [k, h] of Object.entries(golden.sections)) if (k in got && got[k] !== h) problems.push(`section "${k}" markup changed (sha ${got[k].slice(0, 10)} vs golden ${h.slice(0, 10)})`);
report(problems, `${Object.keys(golden.sections).length} other home sections byte-identical to origin/main ${golden.head.slice(0, 8)}`);
