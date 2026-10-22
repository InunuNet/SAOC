// nos-faq-public-r57b rendered: PUBLIC and PREVIEW production builds of /national-show/faq at 1280 and 390 (_server.mjs; ports 3010-3019 minus 3002,
// 3013, 3016). QA input, hash-locked. Golden: goldens/edits.json and goldens/render-baseline.json (the render of the FAQ at the base, 6c170c4e, the r57 head; its FAQ page and components are identical to b1c29304,
// recorded with NOS_FAQ_RECORD=1). Nothing here writes: pages are only loaded and measured; Sanity is READ (published perspective, public CDN).
//   The rule under test (Codi, O4): a public build shows only rows with a sourced answer - a row is sourced when it is wired (r57: the base public render
//   carries a [data-faq-wired] block in it) or its Sanity status is 'confirmed' (read live below). Any section left empty is not drawn.
//   PUBLIC
//   D1  the shown rows are exactly the sourced rows, in base order; the sourced set holds at least the dates, cost and venue rows (else INFRA).
//   D2  each shown row's answer text and wired block equal base.
//   D3  the sections are exactly the sourced rows' sections, each with its sourced rows; the jump chips (when more than one section) match the sections.
//   D4  JSON-LD FAQPage lists exactly the shown rows, each with its base answer.
//   D5  exactly one marker in main, outside every row, before the first section, whose text is the preview page-level line (existing copy); none in a summary.
//   D6  heading outline equals base minus the withheld sections' h2.
//   PREVIEW
//   V1  the page equals base: rows, order, answers, wired blocks, per-row markers, the page-level line, JSON-LD, outline.
//   BOTH  B1 (Codi, H4): every [data-confirmation-badge] in main - on the FAQ (the page-level line, and in preview the per-row markers) and on what-to-expect (the
//         public gap notice, and in preview the section markers) - computes text-transform none and letter-spacing normal (0). what-to-expect public must hold >= 1.
//   BOTH  X1: no horizontal overflow; axe no worse than base; hero text unchanged.
// V1 compares marker text (textContent), so the case change does not trip it; B1 pins the case. Element screenshots (r57b-faq-<mode>-<width>.png) land in <checkout>/.tmp/ex-shots/.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { finish, goldenJson, repoRoot, specDir } from './_lib.mjs';
import { authorize, axeSource, require, serve } from './_server.mjs';

const { chromium } = require('playwright');
const G = goldenJson('edits.json');
const RECORD = process.env.NOS_FAQ_RECORD === '1';
const BASELINE = RECORD ? null : goldenJson('render-baseline.json');
const SHOTS = path.join(repoRoot, G.shots);
mkdirSync(SHOTS, { recursive: true });
const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const failures = [];
const recorded = {};

// Sanity status per question, read live (public CDN, published perspective; ids only from .env.local, nothing printed).
async function readStatuses() {
  const env = {};
  try {
    for (const line of readFileSync(path.join(repoRoot, '.env.local'), 'utf8').split('\n')) {
      const m = line.match(/^(NEXT_PUBLIC_SANITY_PROJECT_ID|NEXT_PUBLIC_SANITY_DATASET)=(.*)$/);
      if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
    }
  } catch { /* fall back to the process env */ }
  const project = env.NEXT_PUBLIC_SANITY_PROJECT_ID ?? process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
  const dataset = env.NEXT_PUBLIC_SANITY_DATASET ?? process.env.NEXT_PUBLIC_SANITY_DATASET;
  const url = `https://${project}.apicdn.sanity.io/v${G.sanityApiVersion}/data/query/${dataset}?perspective=published&query=${encodeURIComponent(G.sanityFaqQuery)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`INFRA: Sanity read answered ${res.status}`);
  return Object.fromEntries((await res.json()).result.map((r) => [r.question, r.status]));
}

// Runs in the page.
function measure({ hook }) {
  const squash = (s) => s.replace(/\s+/g, ' ').trim();
  const main = document.querySelector('main') ?? document.body;
  const markerOf = (m) => ({ text: squash(m.textContent), tt: getComputedStyle(m).textTransform, ls: getComputedStyle(m).letterSpacing });
  const first = main.querySelector('section[aria-labelledby^="faq-"]');
  const chips = main.querySelector('[aria-label="FAQ categories"]');
  return {
    docH: document.documentElement.scrollHeight,
    overflowX: document.documentElement.scrollWidth - window.innerWidth,
    outline: [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].map((h) => `${h.tagName} ${squash(h.textContent)}`),
    heroText: squash(document.querySelector('.nos-hero')?.textContent ?? ''),
    rows: [...document.querySelectorAll('[data-faq-summary]')].map((s) => {
      const d = s.closest('details');
      const panel = d.querySelector('.nos-faq-answer');
      const clone = panel ? panel.cloneNode(true) : null;
      if (clone) clone.querySelectorAll('[data-confirmation-badge]').forEach((n) => n.remove());
      return {
        q: squash(s.querySelector('[data-faq-question] > span')?.textContent ?? s.textContent),
        section: d.closest('section')?.getAttribute('aria-labelledby') ?? '',
        summaryText: squash(s.textContent),
        summaryBadges: s.querySelectorAll('[data-confirmation-badge]').length,
        panelBadges: panel ? [...panel.querySelectorAll('[data-confirmation-badge]')].map(markerOf) : [],
        answerText: clone ? squash(clone.textContent) : '',
        wired: panel ? [...panel.querySelectorAll(`[${hook}]`)].map((w) => ({ kind: w.getAttribute(hook), text: squash(w.textContent) })) : [],
      };
    }),
    pageMarkers: [...main.querySelectorAll('[data-confirmation-badge]')]
      .filter((m) => !m.closest('details'))
      .map((m) => ({ ...markerOf(m), beforeList: first ? Boolean(m.compareDocumentPosition(first) & Node.DOCUMENT_POSITION_FOLLOWING) : false })),
    allMarkers: main.querySelectorAll('[data-confirmation-badge]').length,
    badgeStyles: [...main.querySelectorAll('[data-confirmation-badge]')].map(markerOf),
    sections: [...main.querySelectorAll('section[aria-labelledby^="faq-"]')].map((s) => ({ id: s.getAttribute('aria-labelledby'), title: squash(s.querySelector('h2')?.textContent ?? ''), items: s.querySelectorAll('li.nos-faq-item').length })),
    chips: chips ? [...chips.querySelectorAll('a')].map((a) => a.getAttribute('href')) : [],
    jsonld: [...document.querySelectorAll('script[type="application/ld+json"]')].map((s) => s.textContent.trim()).filter((t) => t.includes('FAQPage')),
  };
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const faqJson = (list) => list.flatMap((t) => { try { return JSON.parse(t).mainEntity.map((e) => [e.name, e.acceptedAnswer?.text]); } catch { return [[t, null]]; } });

let statuses = {};
if (!RECORD) {
  try { statuses = await readStatuses(); } catch (e) { failures.push(String(e.message ?? e)); }
}

const browser = await chromium.launch(process.env.NOS_FAQ_CHROME ? { executablePath: process.env.NOS_FAQ_CHROME } : {});
try {
  // NOS_FAQ_MODES=public (or preview) runs one mode per call, so a slow build fits one foreground command.
  for (const mode of (process.env.NOS_FAQ_MODES ?? 'public,preview').split(',')) {
    const srv = await serve(mode);
    if (srv.failures) { failures.push(srv.failures.join('\n')); continue; }
    try {
      for (const width of G.widths) {
        const ctx = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
        await authorize(ctx, srv);
        await ctx.route('**/api/**', (route) => (route.request().method() === 'GET' ? route.continue() : route.abort()));
        const page = await ctx.newPage();
        const at = `${mode} @${width}`;
        const key = `faq:${mode}@${width}`;
        const res = await page.goto(`${srv.origin}${G.faqPath}`, { waitUntil: 'networkidle' });
        if (!res || res.status() !== 200) { failures.push(`${at}: ${G.faqPath} answered ${res?.status()} (INFRA)`); await ctx.close(); continue; }
        const m = await page.evaluate(measure, { hook: G.wiredHook });
        const base = RECORD ? null : BASELINE[key];
        if (!RECORD && !base) { failures.push(`${at}: no baseline for ${key} (INFRA)`); await ctx.close(); continue; }

        await page.addScriptTag({ path: axeSource() });
        const axe = await page.evaluate(async (tags) => {
          const r = await window.axe.run(document, { runOnly: { type: 'tag', values: tags } });
          return Object.fromEntries(r.violations.map((v) => [v.id, v.nodes.length]));
        }, AXE_TAGS);
        recorded[key] = { ...m, axe };

        if (!RECORD) {
          // X1
          if (m.overflowX > 1) failures.push(`${at}: horizontal overflow of ${m.overflowX}px (X1)`);
          for (const [rule, n] of Object.entries(axe)) if (n > (base.axe[rule] ?? 0)) failures.push(`${at}: axe "${rule}" has ${n} node(s), base had ${base.axe[rule] ?? 0} (X1)`);
          if (m.heroText !== base.heroText) failures.push(`${at}: hero text changed (X1)`);

          // B1 faq
          for (const k of m.badgeStyles) {
            if (k.tt !== 'none') failures.push(`${at}: marker "${k.text}" text-transform is ${k.tt}, needs none (B1)`);
            if (k.ls !== 'normal' && parseFloat(k.ls) !== 0) failures.push(`${at}: marker "${k.text}" letter-spacing is ${k.ls}, needs normal (B1)`);
          }
          // B1 what-to-expect
          const wres = await page.goto(`${srv.origin}${G.wtePath}`, { waitUntil: 'networkidle' });
          if (!wres || wres.status() !== 200) failures.push(`${at}: ${G.wtePath} answered ${wres?.status()} (INFRA)`);
          else {
            const wb = await page.evaluate(() => [...(document.querySelector('main') ?? document.body).querySelectorAll('[data-confirmation-badge]')].map((m) => ({ text: m.textContent.replace(/\s+/g, ' ').trim(), tt: getComputedStyle(m).textTransform, ls: getComputedStyle(m).letterSpacing })));
            if (mode === 'public' && wb.length === 0) failures.push(`${at}: INFRA - the public what-to-expect gap notice drew no marker (B1)`);
            for (const k of wb) {
              if (k.tt !== 'none') failures.push(`${at}: ${G.wtePath} marker "${k.text}" text-transform is ${k.tt}, needs none (B1)`);
              if (k.ls !== 'normal' && parseFloat(k.ls) !== 0) failures.push(`${at}: ${G.wtePath} marker "${k.text}" letter-spacing is ${k.ls}, needs normal (B1)`);
            }
          }
          if (mode === 'preview') {
            // V1
            const flat = (rows) => rows.map((r) => ({ q: r.q, summaryText: r.summaryText, answerText: r.answerText, badges: r.panelBadges.map((b) => b.text), wired: r.wired }));
            if (!same(flat(m.rows), flat(base.rows))) failures.push(`${at}: the rows differ from base (V1)`);
            if (!same(m.pageMarkers.map((p) => p.text), base.pageMarkers.map((p) => p.text))) failures.push(`${at}: the page-level line differs from base (V1)`);
            if (!same(faqJson(m.jsonld), faqJson(base.jsonld))) failures.push(`${at}: the FAQPage JSON-LD differs from base (V1)`);
            if (!same(m.outline, base.outline)) failures.push(`${at}: heading outline differs from base (V1)`);
            if (!same(m.sections.map((s) => [s.id, s.items]), base.sections.map((s) => [s.id, s.items]))) failures.push(`${at}: sections differ from base (V1)`);
          } else {
            // D1
            const basePublic = base.rows;
            const sourced = basePublic.filter((r) => r.wired.length > 0 || statuses[r.q] === 'confirmed');
            for (const need of [G.datesQuestion, G.costQuestion, G.venueQuestion]) if (!sourced.some((r) => r.q === need)) failures.push(`${at}: INFRA - "${need}" is not sourced (wired or confirmed), the rule's evidence has changed`);
            if (!same(m.rows.map((r) => r.q), sourced.map((r) => r.q))) failures.push(`${at}: shown rows ${JSON.stringify(m.rows.map((r) => r.q))} are not the sourced rows ${JSON.stringify(sourced.map((r) => r.q))} (D1)`);
            // D2
            const byQ = Object.fromEntries(basePublic.map((r) => [r.q, r]));
            for (const r of m.rows) {
              const b = byQ[r.q];
              if (!b) continue;
              if (r.answerText !== b.answerText) failures.push(`${at}: the answer of "${r.q}" differs from base (D2)`);
              if (!same(r.wired, b.wired)) failures.push(`${at}: the wired block of "${r.q}" differs from base (D2)`);
              if (r.summaryBadges !== 0 || r.panelBadges.length !== 0) failures.push(`${at}: "${r.q}" carries a per-row marker in a public build (D5)`);
            }
            // D3
            const wantSections = [...new Set(sourced.map((r) => r.section))];
            if (!same(m.sections.map((s) => s.id), wantSections)) failures.push(`${at}: sections ${JSON.stringify(m.sections.map((s) => s.id))} are not the sourced rows' sections ${JSON.stringify(wantSections)} (D3)`);
            for (const s of m.sections) if (s.items !== sourced.filter((r) => r.section === s.id).length) failures.push(`${at}: section ${s.id} holds ${s.items} row(s), needs ${sourced.filter((r) => r.section === s.id).length} (D3)`);
            const wantChips = wantSections.length > 1 ? wantSections.map((id) => `#${id}`) : [];
            if (!same(m.chips, wantChips)) failures.push(`${at}: jump chips ${JSON.stringify(m.chips)} do not match the sections ${JSON.stringify(wantChips)} (D3)`);
            // D4
            const wantLd = faqJson(base.jsonld).filter(([name]) => sourced.some((r) => r.q === name));
            if (!same(faqJson(m.jsonld), wantLd)) failures.push(`${at}: FAQPage JSON-LD ${JSON.stringify(faqJson(m.jsonld).map((e) => e[0]))} is not the shown rows with their base answers (D4)`);
            // D5
            const previewLine = BASELINE[`faq:preview@${width}`]?.pageMarkers?.[0]?.text;
            if (m.allMarkers !== 1 || m.pageMarkers.length !== 1) failures.push(`${at}: ${m.allMarkers} marker(s) in main, needs exactly the one page-level line (D5)`);
            else {
              if (!m.pageMarkers[0].beforeList) failures.push(`${at}: the page-level line is not before the first section (D5)`);
              if (m.pageMarkers[0].text !== previewLine) failures.push(`${at}: the page-level line reads "${m.pageMarkers[0].text}", the existing preview line reads "${previewLine}" (D5: no new copy)`);
            }
            // D6
            const hiddenTitles = base.sections.filter((s) => !wantSections.includes(s.id)).map((s) => `H2 ${s.title}`);
            if (!same(m.outline, base.outline.filter((h) => !hiddenTitles.includes(h)))) failures.push(`${at}: heading outline ${JSON.stringify(m.outline)} is not base minus the withheld sections (D6)`);
          }
        }
        await page.locator('main').first().screenshot({ path: path.join(SHOTS, `r57b-faq-${mode}-${width}.png`) }).catch(() => {});
        await ctx.close();
      }
    } finally {
      await srv.stop();
    }
  }
} finally {
  await browser.close();
}

if (RECORD) {
  const file = path.join(specDir, 'goldens', 'render-baseline.json');
  let prior = {};
  try { prior = goldenJson('render-baseline.json'); } catch { /* first recording */ }
  writeFileSync(file, `${JSON.stringify({ ...prior, ...recorded }, null, 2)}\n`);
  console.log(`RECORDED: ${Object.keys(recorded).length} mode/width baselines (${failures.length} measurement failure(s) ignored while recording)`);
  process.exit(0);
}
finish('rendered.mjs', failures, `D1-D6, V1, B1 and X1 hold on ${Object.keys(recorded).length} mode/width renders.`);
