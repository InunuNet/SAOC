#!/usr/bin/env node
// F19-A11 (no-invention, docs/rules/no-invention.md), run on the BETA PREVIEW build: F19 adds no copy and removes none beyond the ruled strings
// (casing, events heading, the sponsors h1 "Sponsors"); the only additions allowed are the existing marker strings and the existing ABSENT sentence. On every SAOC
// route the leaf-text set of <main> (numbers and the show band excluded) equals copy-baseline.json (untouched main) except exactly
// tokens.json copy.removed / copy.added: "Find Your Society" -> "Find your society", "Upcoming society shows" -> (gone, "What's on"
// already exists as the eyebrow text and becomes the h2). The unsourced figures (56 accredited judges, 1990, 184 pages, the yearbook
// editor and ISSN) therefore stay exactly as they are.
// Typographic quotes are folded to straight ones on both sides first (probe below proves a genuinely new word still fails).
// F19_COPY_PUBLIC=1 (A11p) runs the same comparison on the PUBLIC build (PUBLIC_URL): there a removal is also allowed when the removed leaf matches
// provenance.unsourced (vote-1C withholding); every other removal, and every addition beyond the markers/ABSENT sentence, still fails.
// Usage: BASE_URL=http://localhost:3619 node contracts/checks/launch-weekend/f19/check-m-copy.mjs
import { launch, newPage, open, report, loadGolden, normText, PUBLIC_BASE } from './_lib.mjs';
import { SAOC_ROUTES, LEAF_TEXT_SRC } from './_routes.mjs';

const base = loadGolden('copy-baseline.json'); const TK = loadGolden('tokens.json'); const T = TK.copy;
const N = (a) => a.map(normText);
const markerOk = N(T.addedMarkerOk ? [...TK.provenance.markerStrings, TK.provenance.absentSentence] : []);
const remOk = N(T.removed), addOk = N(T.added);
const problems = [];
const PUB = process.env.F19_COPY_PUBLIC === '1';
const unsourced = TK.provenance.unsourced.map((u) => new RegExp(u.re, u.flags || ''));
const probe = (() => { const a = new Set(N(['Don\u2019t \u201Cstop\u201D'])); const b = ['Don\'t "stop"']; const c = ['Don\'t "stop" now']; return b.every((x) => a.has(x)) && !c.every((x) => a.has(x)); })();
if (!probe) { console.error('FAIL: quote normalisation probe (curly equals straight, a new word still differs)'); process.exit(1); }
const browser = await launch();
const { ctx, page } = await newPage(browser, { name: '1280', width: 1280, height: 900 });
for (const r of SAOC_ROUTES) {
  await open(page, r, PUB ? PUBLIC_BASE : undefined);
  const now = new Set(N(await page.evaluate(LEAF_TEXT_SRC))); const was = new Set(N(base.routes[r]));
  const removed = [...was].filter((t) => !now.has(t) && !remOk.includes(t) && !(PUB && unsourced.some((re) => re.test(t))));
  const added = [...now].filter((t) => !was.has(t) && !addOk.includes(t) && !markerOk.includes(t));
  removed.forEach((t) => problems.push(`${r}: text removed "${t.slice(0, 70)}"`));
  added.forEach((t) => problems.push(`${r}: text added "${t.slice(0, 70)}"`));
}
const home = new Set(N(await (async () => { await open(page, '/', PUB ? PUBLIC_BASE : undefined); return page.evaluate(LEAF_TEXT_SRC); })()));
for (const t of PUB ? [] : T.mustSurvive) if (![...home].some((x) => x.includes(t))) problems.push(`/: expected text "${t}" is gone (Brad holds those figures)`);
await ctx.close(); await browser.close();
report(problems, `no copy added or removed on ${SAOC_ROUTES.length} SAOC routes beyond the ruled casing/heading change`);
