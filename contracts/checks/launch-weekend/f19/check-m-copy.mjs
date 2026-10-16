#!/usr/bin/env node
// F19-A11 (no-invention, docs/rules/no-invention.md), run on the BETA PREVIEW build: F19 adds no copy and removes none beyond the ruled strings
// (casing, events heading, the sponsors h1 "Sponsors"); the only additions allowed are the existing marker strings and the existing ABSENT sentence. On every SAOC
// route the leaf-text set of <main> (numbers and the show band excluded) equals copy-baseline.json (untouched main) except exactly
// tokens.json copy.removed / copy.added: "Find Your Society" -> "Find your society", "Upcoming society shows" -> (gone, "What's on"
// already exists as the eyebrow text and becomes the h2). The unsourced figures (56 accredited judges, 1990, 184 pages, the yearbook
// editor and ISSN) therefore stay exactly as they are.
// Usage: BASE_URL=http://localhost:3619 node contracts/checks/launch-weekend/f19/check-m-copy.mjs
import { launch, newPage, open, report, loadGolden } from './_lib.mjs';
import { SAOC_ROUTES, LEAF_TEXT_SRC } from './_routes.mjs';

const base = loadGolden('copy-baseline.json'); const TK = loadGolden('tokens.json'); const T = TK.copy;
const markerOk = T.addedMarkerOk ? [...TK.provenance.markerStrings, TK.provenance.absentSentence] : [];
const problems = [];
const browser = await launch();
const { ctx, page } = await newPage(browser, { name: '1280', width: 1280, height: 900 });
for (const r of SAOC_ROUTES) {
  await open(page, r);
  const now = new Set(await page.evaluate(LEAF_TEXT_SRC)); const was = new Set(base.routes[r]);
  const removed = [...was].filter((t) => !now.has(t) && !T.removed.includes(t));
  const added = [...now].filter((t) => !was.has(t) && !T.added.includes(t) && !markerOk.includes(t));
  removed.forEach((t) => problems.push(`${r}: text removed "${t.slice(0, 70)}"`));
  added.forEach((t) => problems.push(`${r}: text added "${t.slice(0, 70)}"`));
}
const home = new Set(await (async () => { await open(page, '/'); return page.evaluate(LEAF_TEXT_SRC); })());
for (const t of T.mustSurvive) if (![...home].some((x) => x.includes(t))) problems.push(`/: expected text "${t}" is gone (Brad holds those figures)`);
await ctx.close(); await browser.close();
report(problems, `no copy added or removed on ${SAOC_ROUTES.length} SAOC routes beyond the ruled casing/heading change`);
