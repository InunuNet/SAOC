// nos-exhibitors-r56 rendered: PUBLIC and PREVIEW production builds of /national-show/exhibitors at 1280 and 390 (_server.mjs; ports 3010-3019
// minus 3002, 3013, 3016). QA input, hash-locked. Golden: goldens/edits.json (limits) and goldens/render-baseline.json (the 015698f7 render,
// recorded with NOS_EX_RECORD=1 on the unmodified base). Nothing here writes: pages are only loaded, measured, and the disclosure toggled.
//   PUBLIC
//   U1  ExhibitorQuestions is absent: no #exhibitor-questions, no jump chip to it, neither the heading nor the first question text in the raw
//       HTML (the flight payload included) or the rendered text, and the heading outline is the base outline minus the questions slice.
//   U2  the only <details> left is the base's one other disclosure (the "On this page" jump nav).
//   PREVIEW
//   V1  the questions sit in a closed-by-default <details> whose <summary> holds the H2 (same text as base); the 13 question items stay in the
//       DOM but are not shown while closed; opening shows them all, closing hides them again.
//   V2  summary target >= 44px in both axes (and not taller than 120px), a visible disclosure marker (svg), and a visible focus ring
//       (:focus-visible, outline >= 2px, not transparent), proven first on the existing jump-nav summary at 390 as a control.
//   V3  heading outline (every h1-h6, document order) equals the base outline; the jump chip to #exhibitor-questions is kept.
//   V4  the page is shorter than base by (base questions section - slack) up to (+ cap): Codi's "about 3,300px" plus the pill savings.
//   V5  every status pill: text-transform none and letter-spacing normal/0; a pending pill whose text fits the room it has sits on one line (<= 34px), and at least one does.
//   V6  Key dates: no pill in any row, each "When" cell still holds text, the lede/note line is unchanged, 6 rows still.
//   BOTH
//   L1  the standalone links (Show classes, SAOC judging standards, Wild Orchids) are >= 24px tall; the same set as base is present.
//   X1  no horizontal overflow; axe finds no more of any rule than base; hero bottom unchanged; "Date to be confirmed" absent.
// Element screenshots (r56-<mode>-<width>.png) land in <checkout>/.tmp/ex-shots/.
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { finish, goldenJson, repoRoot, specDir } from './_lib.mjs';
import { authorize, axeSource, require, serve } from './_server.mjs';

const { chromium } = require('playwright');
const G = goldenJson('edits.json');
const RECORD = process.env.NOS_EX_RECORD === '1';
const BASELINE = RECORD ? null : goldenJson('render-baseline.json');
const SHOTS = path.join(repoRoot, G.shots);
mkdirSync(SHOTS, { recursive: true });
const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const failures = [];
const recorded = {};

// Runs in the page.
function measure({ qid, linkNames }) {
  // A closed <details> keeps laid-out rects for its skipped content, so shown = visible AND no closed <details> ancestor.
  const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden' && e.checkVisibility() && !e.closest('details:not([open])'); };
  const heading = document.getElementById(qid);
  const qDetails = heading ? heading.closest('details') : null;
  const qSection = heading ? heading.closest('section') : null;
  const summary = qDetails ? qDetails.querySelector(':scope > summary') : null;
  const items = qSection ? [...qSection.querySelectorAll('ul > li')] : [];
  const otherDetails = [...document.querySelectorAll('details')].filter((d) => d !== qDetails);
  const hero = document.querySelector('.nos-hero');
  const note = document.querySelector('[data-nos-keydates] > p');
  const markerOf = (m) => {
    const s = getComputedStyle(m);
    const h = m.getBoundingClientRect().height;
    // Does the pill's text fit one line in the room its parent gives it? (a pill in the narrow step column may legitimately wrap)
    const prev = m.style.whiteSpace; m.style.whiteSpace = 'nowrap'; m.style.display = 'inline-flex';
    const natural = m.getBoundingClientRect().width; m.style.whiteSpace = prev;
    const pcs = getComputedStyle(m.parentElement);
    const room = m.parentElement.clientWidth - parseFloat(pcs.paddingLeft) - parseFloat(pcs.paddingRight);
    return { fits: natural <= room + 0.5,  kind: m.getAttribute('data-exhibitor-marker'), text: m.textContent.trim().slice(0, 70), h: m.getBoundingClientRect().height, tt: s.textTransform, ls: s.letterSpacing, inRow: Boolean(m.closest('[data-nos-keydate-row]')) }; };
  const linkRe = new RegExp(`^(${linkNames.join('|')}) →$`);
  return {
    docH: document.documentElement.scrollHeight,
    overflowX: document.documentElement.scrollWidth - window.innerWidth,
    heroBottom: hero ? hero.getBoundingClientRect().bottom + scrollY : null,
    outline: [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].map((h) => `${h.tagName.toLowerCase()}:${h.textContent.trim()}`),
    qOutline: qSection ? [...qSection.querySelectorAll('h1,h2,h3,h4,h5,h6')].map((h) => `${h.tagName.toLowerCase()}:${h.textContent.trim()}`) : [],
    qHeadingText: heading ? heading.textContent.trim() : null,
    firstQuestion: items[0] ? (items[0].querySelector('h3')?.textContent.trim() ?? '') : null,
    itemCount: items.length,
    itemsShown: items.filter(vis).length,
    qSectionH: qSection ? qSection.getBoundingClientRect().height : null,
    chip: document.querySelectorAll(`a[href="#${qid}"]`).length,
    details: {
      other: otherDetails.length,
      q: qDetails ? {
        open: qDetails.open,
        headingInSummary: Boolean(summary && summary.contains(heading)),
        headingTag: heading.tagName,
        summaryBox: summary ? { w: summary.getBoundingClientRect().width, h: summary.getBoundingClientRect().height } : null,
        marker: summary ? [...summary.querySelectorAll('svg')].some((s) => s.getBoundingClientRect().width > 0) : false,
      } : null,
    },
    markers: [...document.querySelectorAll('[data-exhibitor-marker]')].map(markerOf),
    keyRows: [...document.querySelectorAll('[data-nos-keydate-row]')].map((r) => ({ pills: r.querySelectorAll('[data-exhibitor-marker]').length, when: (r.children[1]?.textContent ?? '').replace(/※/g, '').trim().slice(0, 60) })),
    keyNote: note ? note.textContent.trim() : null,
    heroText: hero ? hero.innerText.trim() : null,
    links: [...document.querySelectorAll('main a')].filter((a) => linkRe.test(a.textContent.trim())).map((a) => ({ t: a.textContent.trim(), h: a.getBoundingClientRect().height })),
    text: document.body.innerText,
  };
}

const needleOf = (q) => (q ? (/[A-Za-z ,]{25,}/.exec(q)?.[0] ?? q).trim() : null);
const occurrences = (hay, needle) => (needle ? hay.split(needle).length - 1 : 0);
function removeSlice(list, slice) {
  if (slice.length === 0) return list;
  for (let i = 0; i + slice.length <= list.length; i++) if (slice.every((s, j) => list[i + j] === s)) return [...list.slice(0, i), ...list.slice(i + slice.length)];
  return list;
}
const same = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);

const browser = await chromium.launch(process.env.NOS_EX_CHROME ? { executablePath: process.env.NOS_EX_CHROME } : {});
try {
  // NOS_EX_MODES=public (or preview) runs one mode per call, so a slow build fits one foreground command.
  for (const mode of (process.env.NOS_EX_MODES ?? 'public,preview').split(',')) {
    const srv = await serve(mode);
    if (srv.failures) { failures.push(srv.failures.join('\n')); continue; }
    try {
      for (const width of G.widths) {
        const at = `${mode} @${width}`;
        const key = `${mode}@${width}`;
        const ctx = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
        await authorize(ctx, srv);
        await ctx.route('**/api/**', (route) => (route.request().method() === 'GET' ? route.continue() : route.abort()));
        const page = await ctx.newPage();
        const res = await page.goto(`${srv.origin}${G.route}`, { waitUntil: 'networkidle' });
        if (!res || res.status() !== 200) { failures.push(`${at}: ${G.route} answered ${res?.status()} (INFRA)`); await ctx.close(); continue; }
        const raw = await (await fetch(`${srv.origin}${G.route}`, { headers: srv.headers })).text();
        const m = await page.evaluate(measure, { qid: G.questionsId, linkNames: G.links });
        const base = RECORD ? null : BASELINE[key];
        if (!RECORD && !base) { failures.push(`${at}: no baseline for ${key} (INFRA)`); await ctx.close(); continue; }

        // V2 control + focus ring + toggle (preview only), measured before axe so the state is the default one.
        let ring = null, control = null, toggled = null;
        if (mode === 'preview') {
          const ringOf = async (loc) => { await page.keyboard.press('Shift'); await loc.focus(); return loc.evaluate((el) => { const s = getComputedStyle(el); return { fv: el.matches(':focus-visible'), style: s.outlineStyle, w: parseFloat(s.outlineWidth), color: s.outlineColor }; }); };
          const q = page.locator(`details:has(> summary #${G.questionsId}) > summary`);
          if (await q.count()) {
            ring = await ringOf(q.first());
            toggled = {};
            await q.first().click();
            toggled.open = await page.evaluate((id) => document.getElementById(id).closest('details').open, G.questionsId);
            toggled.shown = await page.evaluate((id) => [...document.getElementById(id).closest('section').querySelectorAll('ul > li')].filter((e) => e.checkVisibility() && !e.closest('details:not([open])') && e.getBoundingClientRect().height > 0).length, G.questionsId);
            await q.first().click();
            toggled.closed = await page.evaluate((id) => !document.getElementById(id).closest('details').open, G.questionsId);
          }
          if (width === 390) {
            const j = page.locator('details.md\\:hidden > summary');
            if (await j.count()) control = await ringOf(j.first());
          }
        }

        await page.addScriptTag({ path: axeSource() });
        const axe = await page.evaluate(async (tags) => {
          const r = await window.axe.run(document, { runOnly: { type: 'tag', values: tags } });
          return Object.fromEntries(r.violations.map((v) => [v.id, v.nodes.length]));
        }, AXE_TAGS);

        recorded[key] = {
          docH: m.docH, qSectionH: m.qSectionH, heroBottom: m.heroBottom, outline: m.outline, qOutline: m.qOutline, qHeadingText: m.qHeadingText,
          firstQuestion: m.firstQuestion, itemCount: m.itemCount, chip: m.chip, detailsOther: m.details.other, keyNote: m.keyNote, keyRows: m.keyRows.length,
          heroText: m.heroText, links: m.links.map((l) => l.t), axe,
          rawHeadingHits: occurrences(raw, m.qHeadingText ?? '\u0000'), rawQuestionHits: occurrences(raw, needleOf(m.firstQuestion) ?? '\u0000'),
        };
        if (!RECORD) {
          const needleQ = needleOf(base.firstQuestion);
          // X1
          if (m.overflowX > 0) failures.push(`${at}: the page scrolls horizontally by ${m.overflowX}px (X1)`);
          for (const [rule, n] of Object.entries(axe)) if (n > (base.axe[rule] ?? 0)) failures.push(`${at}: axe "${rule}" has ${n} node(s), the base render had ${base.axe[rule] ?? 0} (X1)`);
          if (m.heroBottom !== base.heroBottom) failures.push(`${at}: hero bottom moved ${base.heroBottom} -> ${m.heroBottom} (X1)`);
          for (const s of G.forbiddenCopy) if (m.text.includes(s) || raw.includes(s)) failures.push(`${at}: invented copy "${s}" is on the page (X1)`);
          // L1
          if (!same(m.links.map((l) => l.t).sort(), [...base.links].sort())) failures.push(`${at}: standalone links changed: base [${base.links.join(' | ')}], now [${m.links.map((l) => l.t).join(' | ')}] (L1)`);
          if (m.links.length < 2) failures.push(`${at}: fewer than 2 standalone links found, cannot judge (L1)`);
          for (const l of m.links) if (l.h < G.targets.linkMinPx) failures.push(`${at}: link "${l.t}" is ${l.h.toFixed(1)}px tall, below ${G.targets.linkMinPx}px (L1)`);

          if (mode === 'public') {
            // U1
            if (m.qHeadingText !== null || m.itemCount > 0) failures.push(`${at}: #${G.questionsId} / question items are in the DOM (heading ${JSON.stringify(m.qHeadingText)}, ${m.itemCount} item(s)) (U1)`);
            if (m.chip > 0) failures.push(`${at}: the jump nav still links to #${G.questionsId} (U1)`);
            if (raw.includes(base.qHeadingText ?? '\u0000') || m.text.includes(base.qHeadingText ?? '\u0000')) failures.push(`${at}: "${base.qHeadingText}" is still in the page HTML/text (U1)`);
            if (needleQ && (raw.includes(needleQ) || m.text.includes(needleQ))) failures.push(`${at}: the first open question ("${needleQ}") is still in the page HTML/text (U1)`);
            const want = removeSlice(base.outline, base.qOutline);
            if (!same(m.outline, want)) failures.push(`${at}: heading outline is not the base outline minus the questions slice (U1): now ${m.outline.length} headings, expected ${want.length}`);
            // U2
            if (m.details.other !== base.detailsOther || m.details.q !== null) failures.push(`${at}: <details> count is ${m.details.other + (m.details.q ? 1 : 0)}, expected only the ${base.detailsOther} existing jump-nav one (U2)`);
          } else {
            const q = m.details.q;
            // V1
            if (!q) failures.push(`${at}: #${G.questionsId} is not inside a <details> (V1)`);
            else {
              if (q.open) failures.push(`${at}: the questions <details> is open by default (V1)`);
              if (!q.headingInSummary) failures.push(`${at}: the H2 is not inside the <summary> (V1)`);
              if (q.headingTag !== 'H2') failures.push(`${at}: the heading is ${q.headingTag}, must stay an H2 (V1)`);
              if (m.details.other !== base.detailsOther) failures.push(`${at}: the other <details> count changed ${base.detailsOther} -> ${m.details.other} (V1)`);
              if (m.qHeadingText !== base.qHeadingText) failures.push(`${at}: summary heading text ${JSON.stringify(m.qHeadingText)} differs from base ${JSON.stringify(base.qHeadingText)} (V1)`);
              if (m.itemCount !== base.itemCount) failures.push(`${at}: ${m.itemCount} question items, base had ${base.itemCount} (V1)`);
              if (m.itemsShown !== 0) failures.push(`${at}: ${m.itemsShown} question item(s) are visible while closed (V1)`);
              if (!toggled || !toggled.open || toggled.shown !== base.itemCount || !toggled.closed) failures.push(`${at}: toggle did not open to ${base.itemCount} visible items and close again: ${JSON.stringify(toggled)} (V1)`);
              // V2
              const b = q.summaryBox;
              if (!b || b.h < G.targets.summaryMinPx || b.w < G.targets.summaryMinPx) failures.push(`${at}: summary target is ${b ? `${b.w.toFixed(0)}x${b.h.toFixed(0)}` : 'missing'}px, needs >= ${G.targets.summaryMinPx}px each way (V2)`);
              else if (b.h > G.targets.summaryMaxPx) failures.push(`${at}: summary is ${b.h.toFixed(0)}px tall, over ${G.targets.summaryMaxPx}px (V2)`);
              if (!q.marker) failures.push(`${at}: the summary has no visible disclosure marker (svg) (V2)`);
              if (width === 390 && !(control && control.fv && control.style !== 'none' && control.w >= G.focus.minOutlinePx)) failures.push(`${at}: INFRA - the control (jump-nav summary) did not show a focus ring in this harness: ${JSON.stringify(control)}`);
              if (!ring || !ring.fv || ring.style === 'none' || ring.w < G.focus.minOutlinePx || /rgba\(0, 0, 0, 0\)|transparent/.test(ring.color)) failures.push(`${at}: summary has no visible focus ring: ${JSON.stringify(ring)} (V2)`);
            }
            // V3
            if (!same(m.outline, base.outline)) failures.push(`${at}: heading outline differs from base (V3): now ${m.outline.length} headings, base ${base.outline.length}`);
            if (m.chip !== base.chip) failures.push(`${at}: jump chips to #${G.questionsId}: ${m.chip}, base ${base.chip} (V3)`);
            // V4
            const cut = base.docH - m.docH;
            const lo = base.qSectionH - G.height.slackPx, hi = base.qSectionH + G.height.capPx;
            if (cut < lo || cut > hi) failures.push(`${at}: page is ${cut.toFixed(0)}px shorter than base (${base.docH} -> ${m.docH}), expected ${lo.toFixed(0)}-${hi.toFixed(0)}px (Codi: about ${G.height.codiReductionPx}px) (V4)`);
            // V5
            if (m.markers.length === 0) failures.push(`${at}: no status pill left to judge (V5)`);
            for (const k of m.markers) {
              if (k.tt !== 'none') failures.push(`${at}: pill "${k.text}" text-transform is ${k.tt}, must be none (V5)`);
              if (k.ls !== 'normal' && parseFloat(k.ls) !== 0) failures.push(`${at}: pill "${k.text}" letter-spacing is ${k.ls}, must be normal/0 (V5)`);
              if (k.kind === 'pending' && k.fits && k.h > G.pill.pendingMaxHeightPx) failures.push(`${at}: pending pill "${k.text}" is ${k.h.toFixed(0)}px tall and wraps to 2 lines although its text fits one line in the room it has (V5)`);
            }
            if (!m.markers.some((k) => k.kind === 'pending' && k.fits && k.h <= G.pill.pendingMaxHeightPx)) failures.push(`${at}: no pending pill sits on one line (V5)`);
            // V6
            if (m.keyRows.length !== base.keyRows) failures.push(`${at}: ${m.keyRows.length} key-date rows, base had ${base.keyRows} (V6)`);
            m.keyRows.forEach((r, i) => {
              if (r.pills > 0) failures.push(`${at}: key-date row ${i + 1} still carries a status pill (V6)`);
              if (r.when === '') failures.push(`${at}: key-date row ${i + 1} has an empty "When" cell (V6)`);
            });
            if (!m.keyNote || m.keyNote !== base.keyNote) failures.push(`${at}: the Key dates status line changed: ${JSON.stringify(m.keyNote)} vs base ${JSON.stringify(base.keyNote)} (V6)`);
            if (m.heroText !== base.heroText) failures.push(`${at}: hero text changed (V6)`);
          }
        }
        await page.locator('main').first().screenshot({ path: path.join(SHOTS, `r56-${mode}-${width}.png`) }).catch(() => {});
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
  writeFileSync(path.join(specDir, 'goldens', 'render-baseline.json'), `${JSON.stringify(recorded, null, 2)}\n`);
  console.log(`RECORDED: ${Object.keys(recorded).length} mode/width baselines (${failures.length} measurement failure(s) ignored while recording)`);
  process.exit(0);
}
finish('rendered.mjs', failures, `U1-U2, V1-V6, L1 and X1 hold on ${Object.keys(recorded).length} mode/width renders.`);
