// nos-faq-r57 rendered: PUBLIC and PREVIEW production builds of /national-show/faq and /national-show/what-to-expect at 1280 and 390 (_server.mjs;
// ports 3010-3019 minus 3002, 3013, 3016). QA input, hash-locked. Golden: goldens/edits.json and goldens/render-baseline.json (the base render, recorded
// with NOS_FAQ_RECORD=1 on the unmodified base). Nothing here writes: pages are only loaded and measured. The ticket-hub labels are read live from
// /national-show/tickets (the source of truth the wired rows must match); the venue fact from /national-show.
//   FAQ, BOTH MODES
//   W1  cost row ("How much does it cost to get in?"): a [data-faq-wired] block holding [data-admission-prices] li items equal, as a set, to the hub's
//       fan-link labels that end in a price; a link to /national-show/tickets (text starts with the Sanity link label, >= 44px tall).
//   W2  venue row: its [data-faq-wired] block is exactly the fact-strip venue value.
//   W3  every other row's answer text (markers removed) equals base; the set of rows and their order equals base; JSON-LD FAQPage equals base.
//   X1  no horizontal overflow; axe no worse than base; hero text unchanged; no h1-h6 added or lost.
//   FAQ PREVIEW (P3)
//   P1  no marker inside any <summary> and the summary text is exactly the question (accessible name hygiene); each summary is no taller than the same question in the public base render.
//   P2  exactly ONE marker outside every <details> (the page-level R11 line), before the first section; the two wired rows carry no marker; each other
//       unconfirmed row has exactly one marker, inside its answer panel, text-transform none / letter-spacing normal; the confirmed row has none.
//   FAQ PUBLIC (P2 public)
//   Q1  no marker anywhere in main; every shown row has a non-empty answer; no section without an item.
//   WHAT TO EXPECT, BOTH MODES
//   A1  the Admission section exists, holds [data-admission-prices] with the same label set as the hub, a link to /national-show/tickets (>= 44px), no
//       marker, and none of the unsourced Sanity admission phrases.
//   A2  the venue fact is on the page (the aside the long-form template draws from the same source as the fact strip).
//   A3  public: the holding note no longer names Admission and otherwise equals base minus Admission; headings equal base plus Admission.
//       preview: every other section's text and the heading outline equal base.
// Element screenshots (r57-<page>-<mode>-<width>.png) land in <checkout>/.tmp/ex-shots/.
import { mkdirSync, writeFileSync } from 'node:fs';
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
const PRICE_END = /, R\d+(?:\.\d\d)?$/;

// Runs in the page.
function measure({ page, hook }) {
  const squash = (s) => s.replace(/\s+/g, ' ').trim();
  const main = document.querySelector('main') ?? document.body;
  const markerOf = (m) => { const s = getComputedStyle(m); return { text: squash(m.textContent), tt: s.textTransform, ls: s.letterSpacing, h: m.getBoundingClientRect().height }; };
  const outline = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].map((h) => `${h.tagName} ${squash(h.textContent)}`);
  const out = {
    docH: document.documentElement.scrollHeight,
    overflowX: document.documentElement.scrollWidth - window.innerWidth,
    outline,
    heroText: squash(document.querySelector('.nos-hero')?.textContent ?? ''),
    bodyHasVenue: squash(document.body.textContent),
  };
  if (page === 'faq') {
    out.rows = [...document.querySelectorAll('[data-faq-summary]')].map((s) => {
      const d = s.closest('details');
      const panel = d.querySelector('.nos-faq-answer');
      const q = squash(s.querySelector('[data-faq-question] > span')?.textContent ?? s.textContent);
      const wired = panel ? [...panel.querySelectorAll(`[${hook}]`)] : [];
      const clone = panel ? panel.cloneNode(true) : null;
      if (clone) clone.querySelectorAll('[data-confirmation-badge]').forEach((n) => n.remove());
      return {
        q,
        summaryText: squash(s.textContent),
        summaryH: s.getBoundingClientRect().height,
        summaryBadges: s.querySelectorAll('[data-confirmation-badge]').length,
        panelBadges: panel ? [...panel.querySelectorAll('[data-confirmation-badge]')].map(markerOf) : [],
        answerText: clone ? squash(clone.textContent) : '',
        wired: wired.map((w) => ({ kind: w.getAttribute(hook), text: squash(w.textContent) })),
        items: panel ? [...panel.querySelectorAll('[data-admission-prices] li')].map((li) => squash(li.textContent)) : [],
        links: panel ? [...panel.querySelectorAll('a')].map((a) => ({ href: a.getAttribute('href'), text: squash(a.textContent), h: a.getBoundingClientRect().height })) : [],
      };
    });
    const first = main.querySelector('section[aria-labelledby^="faq-"]');
    out.pageMarkers = [...main.querySelectorAll('[data-confirmation-badge]')]
      .filter((m) => !m.closest('details'))
      .map((m) => ({ ...markerOf(m), beforeList: first ? Boolean(m.compareDocumentPosition(first) & Node.DOCUMENT_POSITION_FOLLOWING) : false }));
    out.allMarkers = main.querySelectorAll('[data-confirmation-badge]').length;
    out.sections = [...main.querySelectorAll('section[aria-labelledby^="faq-"]')].map((s) => ({ id: s.getAttribute('aria-labelledby'), items: s.querySelectorAll('ul > li').length }));
    out.jsonld = [...document.querySelectorAll('script[type="application/ld+json"]')].map((s) => s.textContent.trim()).filter((t) => t.includes('FAQPage'));
  } else {
    const sections = [...main.querySelectorAll('section.nos-surface')];
    out.sections = Object.fromEntries(sections.map((s) => [squash(s.querySelector('h2')?.textContent ?? ''), squash(s.textContent)]));
    const adm = sections.find((s) => squash(s.querySelector('h2')?.textContent ?? '') === 'Admission');
    out.admission = adm ? {
      items: [...adm.querySelectorAll('[data-admission-prices] li')].map((li) => squash(li.textContent)),
      links: [...adm.querySelectorAll('a')].map((a) => ({ href: a.getAttribute('href'), text: squash(a.textContent), h: a.getBoundingClientRect().height })),
      badges: adm.querySelectorAll('[data-confirmation-badge]').length,
      text: squash(adm.textContent),
    } : null;
    out.holding = squash(document.querySelector('[data-status-list]')?.textContent ?? '');
    out.badgeCount = main.querySelectorAll('[data-confirmation-badge]').length;
  }
  return out;
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const setEq = (a, b) => same([...new Set(a)].sort(), [...new Set(b)].sort());
const faqJson = (list) => list.map((t) => { try { return JSON.parse(t).mainEntity.map((e) => [e.name, e.acceptedAnswer?.text]); } catch { return t; } });

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
        const open = async (route) => {
          const res = await page.goto(`${srv.origin}${route}`, { waitUntil: 'networkidle' });
          if (!res || res.status() !== 200) { failures.push(`${mode} @${width}: ${route} answered ${res?.status()} (INFRA)`); return false; }
          return true;
        };
        // Live controls: the hub's fan-link labels and the fact-strip venue.
        if (!(await open(G.hubPath))) { await ctx.close(); continue; }
        const hubLabels = (await page.$$eval('a[data-fan-link]', (as) => as.map((a) => a.getAttribute('aria-label') ?? ''))).filter((l) => PRICE_END.test(l));
        if (!(await open(G.showPath))) { await ctx.close(); continue; }
        const venueOnShow = (await page.evaluate(() => document.body.textContent.replace(/\s+/g, ' '))).includes(G.venueFact);
        if (hubLabels.length === 0) failures.push(`${mode} @${width}: INFRA - the hub shows no priced fan link`);
        if (!venueOnShow) failures.push(`${mode} @${width}: INFRA - the fact strip on ${G.showPath} no longer shows "${G.venueFact}"`);

        for (const pageKey of ['faq', 'wte']) {
          const route = pageKey === 'faq' ? G.faqPath : G.wtePath;
          const at = `${mode} @${width} ${pageKey}`;
          const key = `${pageKey}:${mode}@${width}`;
          if (!(await open(route))) continue;
          const m = await page.evaluate(measure, { page: pageKey, hook: G.wiredHook });
          const base = RECORD ? null : BASELINE[key];
          if (!RECORD && !base) { failures.push(`${at}: no baseline for ${key} (INFRA)`); continue; }

          await page.addScriptTag({ path: axeSource() });
          const axe = await page.evaluate(async (tags) => {
            const r = await window.axe.run(document, { runOnly: { type: 'tag', values: tags } });
            return Object.fromEntries(r.violations.map((v) => [v.id, v.nodes.length]));
          }, AXE_TAGS);
          const { bodyHasVenue, ...keep } = m;
          recorded[key] = { ...keep, axe, hubLabels };

          if (!RECORD) {
            // X1 (both pages)
            if (m.overflowX > 1) failures.push(`${at}: horizontal overflow of ${m.overflowX}px (X1)`);
            for (const [rule, n] of Object.entries(axe)) if (n > (base.axe[rule] ?? 0)) failures.push(`${at}: axe "${rule}" has ${n} node(s), base had ${base.axe[rule] ?? 0} (X1)`);
            if (m.heroText !== base.heroText) failures.push(`${at}: hero text changed (X1)`);

            if (pageKey === 'faq') {
              const byQ = (rows) => Object.fromEntries(rows.map((r) => [r.q, r]));
              const rows = byQ(m.rows), baseRows = byQ(base.rows);
              if (!same(m.rows.map((r) => r.q), base.rows.map((r) => r.q))) failures.push(`${at}: the rows or their order differ from base (W3)`);
              if (!same(m.outline, base.outline)) failures.push(`${at}: heading outline differs from base (X1)`);
              if (!same(faqJson(m.jsonld), faqJson(base.jsonld))) failures.push(`${at}: the FAQPage JSON-LD differs from base (W3)`);
              // W1 cost row
              const cost = rows[G.costQuestion];
              if (!cost) failures.push(`${at}: the cost row is missing (W1)`);
              else {
                if (cost.wired.length !== 1) failures.push(`${at}: the cost row has ${cost.wired.length} [${G.wiredHook}] block(s), needs 1 (W1)`);
                if (cost.items.length === 0 || !setEq(cost.items, hubLabels)) failures.push(`${at}: cost row items ${JSON.stringify(cost.items)} are not the hub's priced labels ${JSON.stringify(hubLabels)} (W1)`);
                const link = cost.links.find((l) => l.href === G.ticketsHref);
                if (!link || !link.text.startsWith(G.linkLabel)) failures.push(`${at}: the cost row has no "${G.linkLabel}" link to ${G.ticketsHref}: ${JSON.stringify(cost.links)} (W1)`);
                else if (link.h < G.linkMinPx) failures.push(`${at}: the Tickets link is ${link.h.toFixed(0)}px tall, needs >= ${G.linkMinPx}px (W1)`);
              }
              // W2 venue row
              const venue = rows[G.venueQuestion];
              if (!venue) failures.push(`${at}: the venue row is missing (W2)`);
              else if (venue.wired.length !== 1 || venue.wired[0].text !== G.venueFact) failures.push(`${at}: venue row wired block is ${JSON.stringify(venue.wired)}, needs exactly "${G.venueFact}" (W2)`);
              // W3 every other row unchanged
              for (const r of m.rows) {
                if (r.q === G.costQuestion || r.q === G.venueQuestion) continue;
                if (baseRows[r.q] && r.answerText !== baseRows[r.q].answerText) failures.push(`${at}: the answer of "${r.q}" changed (W3)`);
                if (r.wired.length > 0) failures.push(`${at}: "${r.q}" carries a [${G.wiredHook}] block, only the cost and venue rows may (W3)`);
              }
              if (mode === 'preview') {
                // P1
                for (const r of m.rows) {
                  if (r.summaryBadges !== 0) failures.push(`${at}: "${r.q}" has a marker inside its summary (P1)`);
                  if (r.summaryText !== r.q) failures.push(`${at}: summary text "${r.summaryText}" is not exactly the question "${r.q}" (P1)`);
                  // The same question with no pill is as tall as it is in the public base render (the question alone sets the height).
                  const pub = (BASELINE[`faq:public@${width}`]?.rows ?? []).find((x) => x.q === r.q);
                  if (pub && r.summaryH > pub.summaryH + 1) failures.push(`${at}: "${r.q}" summary is ${r.summaryH.toFixed(0)}px, the question alone is ${pub.summaryH.toFixed(0)}px (P1)`);
                }
                // P2
                if (m.pageMarkers.length !== 1) failures.push(`${at}: ${m.pageMarkers.length} marker(s) outside the rows, needs the one page-level line (P2)`);
                else if (!m.pageMarkers[0].beforeList) failures.push(`${at}: the page-level marker is not before the first section (P2)`);
                for (const r of m.rows) {
                  const confirmedOrWired = r.q === G.datesQuestion || r.q === G.costQuestion || r.q === G.venueQuestion;
                  const want = confirmedOrWired ? 0 : 1;
                  if (r.panelBadges.length !== want) failures.push(`${at}: "${r.q}" has ${r.panelBadges.length} marker(s) in its answer, needs ${want} (P2)`);
                  for (const k of r.panelBadges) {
                    if (k.tt !== 'none') failures.push(`${at}: "${r.q}" marker text-transform is ${k.tt}, needs none (P2)`);
                    if (k.ls !== 'normal' && parseFloat(k.ls) !== 0) failures.push(`${at}: "${r.q}" marker letter-spacing is ${k.ls}, needs normal (P2)`);
                  }
                }
              } else {
                // Q1 public
                if (m.allMarkers !== 0) failures.push(`${at}: ${m.allMarkers} marker(s) in the public page (Q1)`);
                for (const r of m.rows) if (r.answerText === '' && r.wired.length === 0) failures.push(`${at}: "${r.q}" is shown with an empty answer (Q1)`);
                for (const s of m.sections) if (s.items === 0) failures.push(`${at}: section ${s.id} is empty (Q1)`);
              }
            } else {
              // A1
              const a = m.admission;
              if (!a) failures.push(`${at}: no Admission section (A1)`);
              else {
                if (a.items.length === 0 || !setEq(a.items, hubLabels)) failures.push(`${at}: Admission items ${JSON.stringify(a.items)} are not the hub's priced labels ${JSON.stringify(hubLabels)} (A1)`);
                const link = a.links.find((l) => l.href === G.ticketsHref);
                if (!link) failures.push(`${at}: Admission has no link to ${G.ticketsHref} (A1)`);
                else if (link.h < G.linkMinPx) failures.push(`${at}: the Admission link is ${link.h.toFixed(0)}px tall, needs >= ${G.linkMinPx}px (A1)`);
                if (a.badges !== 0) failures.push(`${at}: Admission still carries ${a.badges} marker(s) (A1)`);
                for (const phrase of G.unsourcedAdmissionPhrases) if (a.text.includes(phrase)) failures.push(`${at}: Admission still says "${phrase}" (A1)`);
              }
              // A2 venue fact on the page
              if (!bodyHasVenue.includes(G.venueFact)) failures.push(`${at}: the venue fact "${G.venueFact}" is not on the page (A2)`);
              // A3
              if (mode === 'public') {
                if (/\badmission\b/i.test(m.holding)) failures.push(`${at}: the holding note still names Admission: "${m.holding}" (A3)`);
                const baseItems = base.holding.replace(/\.$/, '').split(' · ').filter((x) => x.toLowerCase() !== 'admission');
                const nowItems = m.holding.replace(/\.$/, '').split(' · ').filter(Boolean);
                if (!same(nowItems.map((x) => x.toLowerCase()), baseItems.map((x) => x.toLowerCase()))) failures.push(`${at}: the holding note is "${m.holding}", base minus Admission is "${baseItems.join(' · ')}" (A3)`);
                if (!same(m.outline.filter((h) => h !== 'H2 Admission'), base.outline)) failures.push(`${at}: headings other than Admission differ from base (A3)`);
              } else {
                if (!same(m.outline, base.outline)) failures.push(`${at}: heading outline differs from base (A3)`);
                for (const [h, text] of Object.entries(m.sections)) if (h !== 'Admission' && text !== base.sections[h]) failures.push(`${at}: section "${h}" changed (A3)`);
              }
            }
          }
          await page.locator('main').first().screenshot({ path: path.join(SHOTS, `r57-${pageKey}-${mode}-${width}.png`) }).catch(() => {});
        }
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
  console.log(`RECORDED: ${Object.keys(recorded).length} page/mode/width baselines (${failures.length} measurement failure(s) ignored while recording)`);
  process.exit(0);
}
finish('rendered.mjs', failures, `W1-W3, P1-P2, Q1, A1-A3 and X1 hold on ${Object.keys(recorded).length} page/mode/width renders.`);
