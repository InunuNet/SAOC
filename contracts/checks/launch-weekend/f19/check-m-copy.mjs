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
// FURNITURE RULE (A11p): withholding a fact also removes the labels, headings and role names around it. On the public build a removed leaf is therefore also
// allowed when the same leaf sits inside a [data-placeholder] element on the BETA build (BASE_URL, read in the same run). Leaves are compared after quote folding and
// after stripping leading punctuation ('. ', ', ') so a sentence fragment that loses its stray lead-in after a removed fact still matches. A removal that is not
// marked on beta, and any addition, still fails (probes below).
// Usage: BASE_URL=http://localhost:3619 node contracts/checks/launch-weekend/f19/check-m-copy.mjs
import { launch, newPage, open, report, loadGolden, normText, PUBLIC_BASE } from './_lib.mjs';
import { SAOC_ROUTES, LEAF_TEXT_SRC } from './_routes.mjs';

const base = loadGolden('copy-baseline.json'); const TK = loadGolden('tokens.json'); const T = TK.copy;
const N = (a) => a.map(normText);
const lead = (t) => t.replace(/^[\s.,;:]+/, '');
const classify = ({ was, now, markedBeta, pub, unsourced, remOk, addOk, markerOk }) => {
  const W = new Set(was.map(lead)), Nw = new Set(now.map(lead)), mb = new Set(markedBeta.map(lead));
  const removed = [...W].filter((t) => !Nw.has(t) && !remOk.includes(t) && !(pub && (mb.has(t) || unsourced.some((re) => re.test(t)))));
  const added = [...Nw].filter((t) => !W.has(t) && !addOk.includes(t) && !markerOk.includes(t));
  return { removed, added };
};
{ const a = { was: ['Editor', 'Kept'], now: ['Kept'], markedBeta: ['Editor'], pub: true, unsourced: [], remOk: [], addOk: [], markerOk: [] };
  const okRemoved = classify(a).removed.length === 0;
  const unmarkedFails = classify({ ...a, markedBeta: [] }).removed.length === 1;
  const additionFails = classify({ ...a, now: ['Kept', 'Brand new words'] }).added.length === 1;
  const leadOk = classify({ ...a, was: ['. Kept on'], now: ['Kept on'], markedBeta: [] }).removed.length === 0;
  if (!(okRemoved && unmarkedFails && additionFails && leadOk)) { console.error('FAIL: furniture-rule probe (marked removal passes, unmarked removal fails, addition fails, lead-in punctuation folded)'); process.exit(1); } }
const markerOk = N(T.addedMarkerOk ? [...TK.provenance.markerStrings, TK.provenance.absentSentence] : []);
const remOk = N(T.removed), addOk = N(T.added);
const problems = [];
const PUB = process.env.F19_COPY_PUBLIC === '1';
const unsourced = TK.provenance.unsourced.map((u) => new RegExp(u.re, u.flags || ''));
const probe = (() => { const a = new Set(N(['Don\u2019t \u201Cstop\u201D'])); const b = ['Don\'t "stop"']; const c = ['Don\'t "stop" now']; return b.every((x) => a.has(x)) && !c.every((x) => a.has(x)); })();
if (!probe) { console.error('FAIL: quote normalisation probe (curly equals straight, a new word still differs)'); process.exit(1); }
const browser = await launch();
const { ctx, page } = await newPage(browser, { name: '1280', width: 1280, height: 900 });
// Leaves of <main> that sit inside a [data-placeholder] element (same text fingerprint as LEAF_TEXT_SRC, restricted).
const MARKED_SRC = LEAF_TEXT_SRC.replace("n.parentElement.closest('[data-home-section=\"show-band\"], script, style, noscript')", "n.parentElement.closest('[data-home-section=\"show-band\"], script, style, noscript') || !n.parentElement.closest('[data-placeholder]')");
if (MARKED_SRC === LEAF_TEXT_SRC) { console.error('FAIL: internal - MARKED_SRC patch did not apply (LEAF_TEXT_SRC changed)'); process.exit(1); }
for (const r of SAOC_ROUTES) {
  let markedBeta = [];
  if (PUB) { await open(page, r); markedBeta = N(await page.evaluate(MARKED_SRC)); }
  await open(page, r, PUB ? PUBLIC_BASE : undefined);
  const now = N(await page.evaluate(LEAF_TEXT_SRC)); const was = N(base.routes[r]);
  const { removed, added } = classify({ was, now, markedBeta, pub: PUB, unsourced, remOk, addOk, markerOk });
  removed.forEach((t) => problems.push(`${r}: text removed "${t.slice(0, 70)}"`));
  added.forEach((t) => problems.push(`${r}: text added "${t.slice(0, 70)}"`));
}
const home = new Set(N(await (async () => { await open(page, '/', PUB ? PUBLIC_BASE : undefined); return page.evaluate(LEAF_TEXT_SRC); })()));
for (const t of PUB ? [] : T.mustSurvive) if (![...home].some((x) => x.includes(t))) problems.push(`/: expected text "${t}" is gone (Brad holds those figures)`);
await ctx.close(); await browser.close();
report(problems, `no copy added or removed on ${SAOC_ROUTES.length} SAOC routes beyond the ruled casing/heading change`);
