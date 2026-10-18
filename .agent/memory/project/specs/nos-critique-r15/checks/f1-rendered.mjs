// nos-critique-r15 f1 rendered (production builds, next start 3010-3019 minus 3013). QA input, hash-locked.
// F1 (lead ruling FINAL 2026-10-18): the PUBLIC build withholds the unsourced per-society estimates; the beta PREVIEW build is unchanged.
// Routes and strings: goldens/f1-withhold.json. Widths 1280 and 390. Two builds (public, preview), managed by _server.mjs ensureBuild.
//   PUBLIC
//     P1  main's rendered text on /societies and the three society pages carries none of the golden strings for that route and no
//         estimate figure ("Founded YYYY", "N members"); the served HTML (incl. the RSC payload a client component receives) carries no
//         placeholder-true flag and no non-null founded/memberCount value.
//     P2  /societies still lists the preview's societies: same count, and each card's text equals its preview text with only the
//         estimate parts ("· Founded YYYY", "· N members", "(estimated)") removed; 3 columns at 1280, 1 at 390.
//     P3  society pages: no section is left holding only its eyebrow (withholding the fallback must not orphan "About this society"), and
//         the closing CTA keeps its eyebrow, heading and both buttons once its body is withheld (golden `cta`).
//     P4  no horizontal overflow on any measured page.
//   PREVIEW
//     V1  every golden string still shows on its routes, and main's markup equals the BASE preview capture (goldens/f1-baseline.json,
//         sha256 of main.innerHTML) at both widths: byte-unchanged.
// `--capture` prints goldens/f1-baseline.json from the current preview build (captured by @architect on BASE ab7c549c).
import { createHash } from 'node:crypto';

import { finish, golden, goldenJson } from './_lib.mjs';
import { require, serve } from './_server.mjs';

const { chromium } = require('playwright');
const NAME = 'f1-rendered.mjs';
const CAPTURE = process.argv.includes('--capture');
const WIDTHS = [1280, 390];
const G = goldenJson('f1-withhold.json');
const norm = (t) => (t ?? '').replace(/\s+/g, ' ').trim();
const lower = (t) => norm(t).toLowerCase();
const stripEstimates = (t) => norm(t.replace(/\s*·\s*Founded \d{4}/g, '').replace(/\s*·\s*~?\d+ members/g, '').replace(/^Founded \d{4}\s*·?\s*/, '').replace(/^~?\d+ members/, '').replace(/\(estimated\)/gi, ''));
const failures = [];
const got = { public: {}, preview: {} };

async function measure(mode) {
  const srv = await serve(mode);
  if (srv.failures) { failures.push(...srv.failures.map((f) => `${mode}: ${f}`)); return; }
  const browser = await chromium.launch();
  try {
    for (const width of WIDTHS) {
      const ctx = await browser.newContext({ viewport: { width, height: 900 }, extraHTTPHeaders: srv.headers });
      const page = await ctx.newPage();
      for (const route of G.routes) {
        const res = await page.goto(`${srv.origin}${route}`, { waitUntil: 'networkidle' });
        if (!res || res.status() !== 200) { failures.push(`${mode} ${route} @${width}: HTTP ${res ? res.status() : 'none'}`); continue; }
        if (route === '/societies') await page.waitForSelector('main a[href^="/societies/"]', { timeout: 15000 }).catch(() => {});
        got[mode][`${route} @${width}`] = await page.evaluate(() => {
          const main = document.querySelector('main');
          const cards = [...main.querySelectorAll('a[href^="/societies/"]')].filter((a) => a.closest('.grid')).map((a) => { const r = a.getBoundingClientRect(); return { text: a.innerText, left: Math.round(r.left), top: Math.round(r.top + scrollY), h: Math.round(r.height) }; });
          const orphans = [...main.querySelectorAll('section')].filter((s) => { const e = s.querySelector(':scope > .eyebrow'); return e && s.innerText.replace(/\s+/g, ' ').trim() === e.innerText.replace(/\s+/g, ' ').trim(); }).map((s) => s.innerText.trim());
          const band = [...document.querySelectorAll('section')].find((s) => s.querySelector(':scope h2') && s.querySelector('a[href="/contact"]') && s.querySelector('a[href="/societies"]'));
          const cta = band ? { eyebrow: band.querySelector('.eyebrow')?.innerText.trim() ?? '', heading: band.querySelector('h2').innerText.trim(), links: [...band.querySelectorAll('a')].map((a) => a.innerText.trim()), paras: [...band.querySelectorAll('p')].map((p) => p.innerText.trim()) } : null;
          return { html: main.innerHTML, text: main.innerText, cards, orphans, cta, overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth };
        });
        if (mode === 'public' && width === WIDTHS[0]) {
          const raw = await (await fetch(`${srv.origin}${route}`, { headers: srv.headers })).text();
          got[mode][`${route} @${width}`].raw = raw;
        }
      }
      await ctx.close();
    }
  } catch (e) {
    failures.push(`${mode}: render error: ${e && e.message ? e.message : e}`);
  } finally {
    await browser.close();
    await srv.stop();
  }
}

const sha = (s) => createHash('sha256').update(s).digest('hex');
if (CAPTURE) {
  await measure('preview');
  if (failures.length) finish(NAME, failures);
  const out = {};
  for (const [k, m] of Object.entries(got.preview)) out[k] = { sha256: sha(m.html), length: m.html.length, cards: m.cards.map((c) => norm(c.text)), text: norm(m.text) };
  process.stdout.write(`${JSON.stringify({ recorded: 'preview build of BASE ab7c549c (SHOW_PLACEHOLDER_PREVIEW=true, beta wall up), main.innerHTML sha256', got: out }, null, 1)}\n`);
  process.exit(0);
}

await measure('public');
await measure('preview');
const baseline = JSON.parse(golden('f1-baseline.json')).got;
const forRoute = (route) => G.strings.filter((s) => s.routes.includes(route === '/societies' ? '/societies' : 'slug'));

for (const [key, m] of Object.entries(got.public)) {
  const route = key.split(' @')[0];
  const width = Number(key.split('@')[1]);
  const text = lower(m.text);
  for (const s of forRoute(route)) if (text.includes(s.text.toLowerCase())) failures.push(`public ${key}: shows "${s.text}" (${s.id}, ${s.source}) (P1)`);
  for (const p of G.estimatePatterns) { const hit = new RegExp(p).exec(norm(m.text)); if (hit) failures.push(`public ${key}: shows the estimate "${hit[0]}" (P1)`); }
  if (m.raw !== undefined) for (const p of G.payloadPatterns) { const hit = new RegExp(p).exec(m.raw); if (hit) failures.push(`public ${route}: the served HTML/RSC payload still carries ${JSON.stringify(hit[0])} (P1: decide on the server)`); }
  if (m.overflow > 0) failures.push(`public ${key}: scrolls horizontally by ${m.overflow}px (P4)`);
  const b = baseline[key];
  if (route === '/societies') {
    if (!b) { failures.push(`${key}: no preview baseline`); continue; }
    const want = b.cards.map(stripEstimates);
    const have = m.cards.map((c) => norm(c.text));
    if (have.length !== want.length) failures.push(`public ${key}: ${have.length} cards, preview lists ${want.length} (P2)`);
    else have.forEach((t, i) => { if (t !== want[i]) failures.push(`public ${key}: card ${i} reads "${t}", want "${want[i]}" (P2)`); });
    const cols = m.cards.filter((c) => c.top === m.cards[0]?.top).length;
    const wantCols = width >= 1024 ? 3 : 1;
    if (m.cards.length && cols !== wantCols) failures.push(`public ${key}: ${cols} card column(s) in the first row, want ${wantCols} (P2 layout)`);
  } else {
    if (m.orphans.length) failures.push(`public ${key}: section(s) left holding only their eyebrow: ${JSON.stringify(m.orphans)} (P3)`);
    if (!m.cta) failures.push(`public ${key}: the closing CTA band is gone (P3)`);
    else {
      if (lower(m.cta.eyebrow) !== lower(G.cta.eyebrow) || m.cta.heading !== G.cta.heading) failures.push(`public ${key}: CTA reads "${m.cta.eyebrow}" / "${m.cta.heading}", want "${G.cta.eyebrow}" / "${G.cta.heading}" (P3)`);
      for (const l of G.cta.links) if (!m.cta.links.includes(l)) failures.push(`public ${key}: CTA lost its "${l}" button (P3)`);
      if (m.cta.paras.length) failures.push(`public ${key}: CTA still renders body text ${JSON.stringify(m.cta.paras)} (P3)`);
    }
  }
}
for (const [key, m] of Object.entries(got.preview)) {
  const route = key.split(' @')[0];
  const text = lower(m.text);
  for (const s of forRoute(route)) if (!text.includes(s.text.toLowerCase())) failures.push(`preview ${key}: "${s.text}" (${s.id}) no longer shows on the beta preview (V1)`);
  const b = baseline[key];
  if (!b) failures.push(`preview ${key}: no baseline`);
  else if (sha(m.html) !== b.sha256) failures.push(`preview ${key}: main markup changed (sha ${sha(m.html).slice(0, 12)}, length ${m.html.length}; BASE ${b.sha256.slice(0, 12)}, ${b.length}) (V1 byte-unchanged)`);
  if (m.overflow > 0) failures.push(`preview ${key}: scrolls horizontally by ${m.overflow}px`);
}
for (const mode of ['public', 'preview']) for (const key of Object.keys(baseline)) if (!got[mode][key]) failures.push(`${mode} ${key}: not measured`);

finish(NAME, failures, `public /societies and ${G.routes.length - 1} society pages carry no estimate, caption, marker, generic prose or CTA count (HTML and payload clean, cards and grid intact, CTA heading and buttons kept, no orphan section, no overflow); the beta preview is byte-unchanged at ${WIDTHS.join('/')}.`);
