// nos-critique-r20 F2 rendered (fresh PUBLIC and PREVIEW production builds, next start 3010-3019 minus 3013). QA input, hash-locked.
// Goldens: goldens/f2-edits.json (routes, target), f2-baseline.json (BASE pairs). Both modes, 1280 and 390. A "pair" is two adjacent
// sibling section.nos-section elements; its tone is the NosSection tone class (gold / royal / black, none = default; a bg- utility = its own
// ground) and its gap is the distance from the leader's [data-nos-wrap] bottom to the follower's [data-nos-wrap] top.
//   P1  same-tone pairs (same tone, same computed background): the follower's padding-top is 0 and the gap is BASE's minus the follower's
//       BASE padding-top (+-1px), so ONE rhythm unit remains. A pair already collapsed at BASE (follower padding-top 0: the hub's
//       .nos-section-joined, the r12 status-disclosure rule, the workshops page) keeps its BASE gap exactly: never collapsed twice.
//   P2  different-tone pairs keep the follower's BASE padding-top and the BASE gap (+-1px).
//   P3  every route has the BASE pairs, in order, with the BASE tones; no horizontal overflow.
//   P4  the ruling's case: /national-show/what-to-expect at 1280, the pair led by the "Accessibility" block, loses exactly one section
//       padding (the follower's BASE padding-top, 120px at 1280).
// `--capture` prints goldens/f2-baseline.json (captured by @architect on BASE a4807791, both modes).
import { BASE, finish, goldenJson } from './_lib.mjs';
import { MODES, require, serve } from './_server.mjs';

const { chromium } = require('playwright');
const NAME = 'f2-rendered.mjs';
const CAPTURE = process.argv.includes('--capture');
const G = goldenJson('f2-edits.json');
const WIDTHS = [1280, 390];
const failures = [];
const got = {};
const near = (a, b) => Math.abs(a - b) <= 1;

const pairsOf = (page) => page.evaluate(() => {
  const tone = (el) => (/\bbg-/.test(el.className) ? 'bg' : (['gold', 'royal', 'black'].find((t) => el.classList.contains(`nos-section-${t}`)) ?? 'default'));
  const wrap = (el) => el.querySelector(':scope > [data-nos-wrap]') ?? el;
  const out = [];
  for (const a of document.querySelectorAll('section.nos-section')) {
    const b = a.nextElementSibling;
    if (!b || !b.matches('section.nos-section')) continue;
    const ca = getComputedStyle(a); const cb = getComputedStyle(b);
    out.push({
      tones: [tone(a), tone(b)], grounds: [ca.backgroundColor, cb.backgroundColor],
      leaderPb: parseFloat(ca.paddingBottom), followerPt: parseFloat(cb.paddingTop),
      gap: wrap(b).getBoundingClientRect().top - wrap(a).getBoundingClientRect().bottom,
      lead: (a.querySelector('h2, h3')?.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 60),
      leaderHeadings: [...a.querySelectorAll('h2, h3')].map((h) => h.textContent.replace(/\s+/g, ' ').trim()),
    });
  }
  return { pairs: out, overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth };
});

for (const mode of MODES) {
  const srv = await serve(mode);
  if (srv.failures) { failures.push(...srv.failures.map((f) => `${mode}: ${f}`)); continue; }
  const browser = await chromium.launch();
  try {
    for (const width of WIDTHS) {
      const ctx = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce', extraHTTPHeaders: srv.headers ?? {} });
      const page = await ctx.newPage();
      for (const route of G.routes) {
        const r = await page.goto(`${srv.origin}${route}`, { waitUntil: 'networkidle' });
        if (!r || r.status() !== 200) { failures.push(`${mode} ${route} @${width}: HTTP ${r ? r.status() : 0}`); continue; }
        await page.evaluate(async () => { await document.fonts.ready; });
        got[`${mode} ${route} @${width}`] = await pairsOf(page);
      }
      await ctx.close();
    }
  } catch (e) {
    failures.push(`render error: ${e && e.message ? e.message : e}`);
  } finally {
    await browser.close();
    await srv.stop();
  }
}

if (CAPTURE) {
  if (failures.length) finish(NAME, failures);
  const t = got[`public ${G.target.route} @${G.target.width}`];
  if (!t || !t.pairs.some((p) => p.leaderHeadings.includes(G.target.leaderHeading))) finish(NAME, [`capture: no ${G.target.route} @${G.target.width} pair led by "${G.target.leaderHeading}"`]);
  process.stdout.write(`${JSON.stringify({ recorded: `${MODES.join(' and ')} builds of BASE ${BASE}: adjacent section.nos-section pairs (tones, grounds, paddings, wrap-to-wrap gap)`, got })}\n`);
  process.exit(0);
}

const baseline = goldenJson('f2-baseline.json').got;
let same = 0; let diff = 0;
for (const [key, m] of Object.entries(got)) {
  const b = baseline[key];
  if (!b) { failures.push(`${key}: no baseline`); continue; }
  if (m.overflow > 0) failures.push(`${key}: scrolls horizontally by ${m.overflow}px (P3)`);
  if (m.pairs.length !== b.pairs.length || !m.pairs.every((p, k) => p.tones.join() === b.pairs[k].tones.join())) { failures.push(`${key}: section pairs ${JSON.stringify(m.pairs.map((p) => p.tones))}, BASE ${JSON.stringify(b.pairs.map((p) => p.tones))} (P3)`); continue; }
  m.pairs.forEach((p, k) => {
    const bp = b.pairs[k];
    const at = `${key} pair ${k + 1} (${p.tones.join(' -> ')}, after "${bp.lead}")`;
    const sameTone = p.tones[0] === p.tones[1] && p.tones[0] !== 'bg' && p.grounds[0] === p.grounds[1];
    if (sameTone) {
      same += 1;
      if (p.followerPt !== 0) failures.push(`${at}: follower padding-top ${p.followerPt}px, want 0 (P1)`);
      if (!near(p.gap, bp.gap - bp.followerPt)) failures.push(`${at}: gap ${Math.round(p.gap)}px, want BASE ${Math.round(bp.gap)} - ${bp.followerPt} = ${Math.round(bp.gap - bp.followerPt)}px (P1)`);
    } else {
      diff += 1;
      if (p.followerPt !== bp.followerPt) failures.push(`${at}: follower padding-top ${p.followerPt}px, BASE ${bp.followerPt}px (P2)`);
      if (!near(p.gap, bp.gap)) failures.push(`${at}: gap ${Math.round(p.gap)}px, BASE ${Math.round(bp.gap)}px (P2)`);
    }
  });
}
for (const mode of MODES) {
  const key = `${mode} ${G.target.route} @${G.target.width}`;
  const m = got[key]; const b = baseline[key];
  const k = b ? b.pairs.findIndex((p) => p.leaderHeadings.includes(G.target.leaderHeading)) : -1;
  if (!m || k < 0 || !m.pairs[k]) { failures.push(`${key}: no "${G.target.leaderHeading}" pair (P4)`); continue; }
  if (!near(b.pairs[k].gap - m.pairs[k].gap, b.pairs[k].followerPt) || b.pairs[k].followerPt <= 0) failures.push(`${key}: the "${G.target.leaderHeading}" gap went ${Math.round(b.pairs[k].gap)} -> ${Math.round(m.pairs[k].gap)}px, want one section padding (${b.pairs[k].followerPt}px) less (P4)`);
}
for (const key of Object.keys(baseline)) if (!got[key]) failures.push(`${key}: in the baseline but not measured`);
finish(NAME, failures, `${Object.keys(got).length} NOS captures: ${same} same-tone pairs share one rhythm unit (none collapsed twice), ${diff} different-tone pairs unchanged, what-to-expect loses exactly one padding.`);
