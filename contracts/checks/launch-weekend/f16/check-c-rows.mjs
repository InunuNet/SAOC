#!/usr/bin/env node
// RETIRED by launch-weekend F18 (goldens/f18/supersession.json): replaced by the v13 keepsake ticket checks; no gate runs this file.
// A3 (F16 R31-A2, amended by F17 scope E): the Visit group as typographic rows, against the live render.
//  One row per product family; every price carries a VISIBLE caption that is its own CMS SKU name (a single-tier row may hide a caption equal to its row name)
//  and its OWN secondary (ghost) action to its own /tickets/<slug> (a sold-out SKU shows its sold-out state on that action, the sibling stays live);
//  the early-bird and standard captions and prices share one computed style (neither reads as the "real" price); no filled button in the group;
//  action names include the SKU name; prices = resolveEffectivePrice of each CMS product; the provisional note sits under the group's h2 and lede, before the rows;
//  no photograph, no FROM block, no overflow at 390/1280/1920. When the live dataset has sales closed the closed branch is asserted instead;
//  the closed path is ALSO proven without any CMS toggle by check-d-render.mts.
// Usage: node --import tsx/esm contracts/checks/launch-weekend/f16/check-c-rows.mjs
import { readFileSync } from 'node:fs';
import { VIEWPORTS, HUB, SEL, launch, newPage, openPath, loadGolden, readCms, report } from './_lib.mjs';
import { resolveEffectivePrice } from '../../../../lib/checkout-reservation.ts';

// The early-bird SKU -> standard SKU pairing (ticketing-flow-redesign golden), restated here so the check does not import the code under test.
const REGULAR_PRICE_SIBLING_SLUG = { 'weekend-pass-early-bird': 'weekend-pass', 'early-bird': 'day-visitor' };
const T = loadGolden('tokens.json').row;
const E = JSON.parse(readFileSync('.agent/memory/project/specs/launch-weekend/goldens/f17/tokens.json', 'utf8')).rows;
const cms = await readCms();
const problems = [];
const bySlug = new Map(cms.types.map((t) => [t.slug, t]));
const expectedRows = cms.types.filter((t) => !(t.slug in REGULAR_PRICE_SIBLING_SLUG && bySlug.has(REGULAR_PRICE_SIBLING_SLUG[t.slug])));
const eff = (t) => resolveEffectivePrice({ price: t.price, regularPrice: t.regularPrice ?? null, earlyBirdCutoff: t.earlyBirdCutoff ?? null, now: new Date() });
const fmt = (n) => (Number.isInteger(n) ? `R${n}` : `R${n.toFixed(2)}`);
const rowFor = (rows, name) => rows.find((r) => r.name === name);

const browser = await launch();
for (const vp of VIEWPORTS) {
  const { ctx, page } = await newPage(browser, vp);
  await openPath(page, HUB);
  const tag = `@${vp.name}`;
  const m = await page.evaluate(({ SEL, E }) => {
    const visit = document.getElementById('visit');
    if (!visit) return { error: 'no #visit group' };
    const fam = (e) => getComputedStyle(e).fontFamily.split(',')[0].replace(/["']/g, '').toLowerCase();
    const sty = (e, props) => props.map((p) => getComputedStyle(e)[p]).join('|');
    const rows = [...visit.querySelectorAll(SEL.row)].map((li) => {
      const r = li.getBoundingClientRect();
      const name = li.querySelector(SEL.rowName);
      const tiers = [...li.querySelectorAll(SEL.tier)].map((t) => {
        const p = t.querySelector(SEL.price); const cap = t.querySelector('[data-ticket-caption]'); const a = t.querySelector(SEL.action);
        const pr = p && p.getBoundingClientRect(); const ar = a && a.getBoundingClientRect(); const cs = a && getComputedStyle(a);
        const capCs = cap && getComputedStyle(cap); const capRect = cap && cap.getBoundingClientRect();
        return {
          kind: t.getAttribute('data-ticket-tier'), caption: cap?.textContent.trim(), captionVisible: !!cap && !cap.classList.contains('sr-only') && capRect.width > 1 && capRect.height > 1,
          capSize: capCs ? parseFloat(capCs.fontSize) : 0, capStyle: cap ? sty(cap, E.equalProps.caption) : '',
          price: p?.textContent.trim(), size: p ? parseFloat(getComputedStyle(p).fontSize) : 0, fam: p ? fam(p) : '', priceStyle: p ? sty(p, E.equalProps.price) : '', bottom: pr ? pr.bottom : 0,
          action: a ? { tag: a.tagName.toLowerCase(), href: a.getAttribute('href'), text: a.textContent.replace(/\s+/g, ' ').trim(), soldOut: a.hasAttribute('data-sold-out'), h: ar.height, w: ar.width, top: ar.top, bg: cs.backgroundColor, border: parseFloat(cs.borderTopWidth) } : null,
        };
      });
      return { h: r.height, w: r.width, left: r.left, name: name?.textContent.trim(), nameFam: name ? fam(name) : '', nameSize: name ? parseFloat(getComputedStyle(name).fontSize) : 0, nameWeight: name ? Number(getComputedStyle(name).fontWeight) : 0, tiers, dayNote: !!li.querySelector(SEL.dayNote) };
    });
    const media = [...document.querySelectorAll('main img, main picture, main svg, main canvas, main video')].filter((e) => !e.closest('[aria-hidden="true"]')).length;
    const bg = [...document.querySelectorAll('main *')].filter((e) => /url\(/.test(getComputedStyle(e).backgroundImage)).length;
    const text = visit.innerText;
    // E3: DOM order inside the group: h2, lede, provisional note, first row.
    const h2 = visit.querySelector('h2'); const firstRow = visit.querySelector(SEL.row);
    const note = [...visit.querySelectorAll('p')].find((p) => /Provisional pricing/.test(p.textContent ?? ''));
    const before = (a, b) => !!(a && b && (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING));
    const lede = h2 ? h2.nextElementSibling : null;
    return {
      rows, media, bg, hasFrom: /(^|\n)\s*from\s*(\n|$)/i.test(text), prices: /\bR\s?\d/.test(text), links: [...visit.querySelectorAll('a[href^="/tickets/"]')].length,
      closed: visit.querySelectorAll(SEL.closed).length, provisional: (text.match(/Provisional pricing/g) || []).length,
      noteText: note?.textContent.trim(), noteAfterH2: before(h2, note), noteAfterLede: !!(lede && note && lede !== note && before(lede, note)), noteBeforeRows: before(note, firstRow),
      noteInsideRows: !!(note && note.closest(SEL.rows)),
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    };
  }, { SEL, E });
  if (m.error) { problems.push(`${tag}: ${m.error}`); await ctx.close(); continue; }
  if (m.media || m.bg) problems.push(`${tag}: ${m.media} media element(s) and ${m.bg} background image(s) in main, want none (typographic, no stock photos)`);
  if (m.hasFrom) problems.push(`${tag}: the orphan FROM price block still renders`);
  if (m.overflow) problems.push(`${tag}: horizontal overflow`);
  if (m.rows.length !== expectedRows.length) problems.push(`${tag}: ${m.rows.length} rows, want ${expectedRows.length} (one per product family)`);
  if (cms.salesOpen) {
    if (m.provisional !== 1) problems.push(`${tag}: ${m.provisional} provisional notes in the Visit group, want exactly 1`);
    if (m.noteText !== E.provisionalText) problems.push(`${tag}: provisional note reads "${m.noteText}", want "${E.provisionalText}"`);
    if (!m.noteAfterH2 || !m.noteAfterLede || !m.noteBeforeRows || m.noteInsideRows) problems.push(`${tag}: the provisional note must sit after the group h2 and its lede and before the first row (after h2 ${m.noteAfterH2}, after lede ${m.noteAfterLede}, before rows ${m.noteBeforeRows}, inside rows ${m.noteInsideRows})`);
    for (const r of m.rows) {
      const t = `${tag} row "${r.name}"`;
      const dual = r.tiers.length > 1;
      if (r.nameFam !== 'fraunces' && !/fraunces/.test(r.nameFam)) problems.push(`${t}: name font ${r.nameFam}, want Fraunces`);
      if (r.nameWeight !== T.nameRole.weight || Math.abs(r.nameSize - T.nameRole.sizePx) > T.nameRole.tolerance) problems.push(`${t}: name is ${r.nameWeight} ${r.nameSize}px, want ${T.nameRole.weight} ${T.nameRole.sizePx}px (R35 card-title role)`);
      if (vp.width >= E.stackBelow && r.h > E.maxRowHeightDesktop) problems.push(`${t}: row is ${r.h.toFixed(0)}px tall, want <=${E.maxRowHeightDesktop}`);
      if (r.tiers.length === 0) problems.push(`${t}: no price while sales are open`);
      for (const x of r.tiers) {
        const id = `${t} tier "${x.caption}"`;
        if (dual && !x.captionVisible) problems.push(`${id}: caption is not visible (a dual row captions both prices)`);
        if (x.captionVisible && x.capSize < E.captionMinPx - 0.1) problems.push(`${id}: caption ${x.capSize}px < ${E.captionMinPx}`);
        if (!/fraunces/.test(x.fam)) problems.push(`${id}: price font ${x.fam}, want Fraunces`);
        if (x.size < E.priceMinPx - 0.5 || x.size > E.priceMaxPx + 0.5) problems.push(`${id}: price is ${x.size}px, want ${E.priceMinPx}-${E.priceMaxPx}`);
        const a = x.action;
        const sameSkuAsPrev = r.tiers.indexOf(x) > 0 && r.tiers[r.tiers.indexOf(x) - 1].caption === x.caption;
        if (!a) { if (!sameSkuAsPrev) problems.push(`${id}: no action of its own`); continue; }
        if (!a.text.includes(x.caption)) problems.push(`${id}: action name "${a.text}" does not include the SKU name`);
        if (a.soldOut) { if (a.tag === 'a') problems.push(`${id}: a sold-out action must not be a link`); }
        else {
          const slug = (a.href ?? '').split('/').pop();
          const sku = cms.types.find((c) => c.name === x.caption);
          if (!/^\/tickets\/[a-z0-9-]+$/.test(a.href ?? '') || !sku || sku.slug !== slug) problems.push(`${id}: action href ${a.href} is not its own SKU /tickets/${sku?.slug}`);
          if (!new RegExp(`^${cms.page.buyButtonLabel || E.actionLabelFallback}`).test(a.text)) problems.push(`${id}: action reads "${a.text}", want the buy label`);
        }
        if (a.h < E.actionMinHeight - 0.5) problems.push(`${id}: action is ${a.h.toFixed(1)}px tall, want >=${E.actionMinHeight}`);
        if (a.bg !== 'rgba(0, 0, 0, 0)' || a.border < 1) problems.push(`${id}: action is filled or borderless (bg ${a.bg}, border ${a.border}px), want the secondary outline style only`);
        if (vp.width < E.stackBelow && x.action.top < x.bottom) problems.push(`${id}: action is not below its own price when stacked`);
      }
      if (dual) {
        const [p, q] = r.tiers;
        if (p.capStyle !== q.capStyle) problems.push(`${t}: the two captions differ in style (${p.capStyle} vs ${q.capStyle}), want equal`);
        if (p.priceStyle !== q.priceStyle) problems.push(`${t}: the two prices differ in style (${p.priceStyle} vs ${q.priceStyle}), want equal`);
      }
    }
    // Prices: each product's effective price shows against its own CMS name.
    const shown = new Map();
    for (const r of m.rows) for (const x of r.tiers) shown.set(x.caption, x.price);
    for (const t of cms.types) {
      const p = eff(t);
      if (p === null) continue;
      if (shown.get(t.name) !== fmt(p)) problems.push(`${tag}: "${t.name}" shows ${shown.get(t.name) ?? 'nothing'}, resolveEffectivePrice says ${fmt(p)}`);
    }
    for (const t of expectedRows) {
      const earlySlug = Object.entries(REGULAR_PRICE_SIBLING_SLUG).find(([, std]) => std === t.slug)?.[0];
      const row = rowFor(m.rows, t.name);
      if (earlySlug && bySlug.has(earlySlug) && row && row.tiers.length !== 2) problems.push(`${tag} row "${t.name}": ${row.tiers.length} price tier(s), want early-bird and standard`);
    }
    const dayCms = cms.types.filter((t) => t.requiresDaySelection).length;
    if (dayCms && !m.rows.some((r) => r.dayNote)) problems.push(`${tag}: day-choice note missing on the day rows`);
  } else {
    if (m.prices || m.links) problems.push(`${tag}: sales closed but ${m.prices ? 'a price' : ''} ${m.links ? 'a ticket link' : ''} renders`);
    if (m.closed !== 1) problems.push(`${tag}: ${m.closed} closed notices, want exactly 1`);
    if (m.provisional) problems.push(`${tag}: the provisional note renders while sales are closed`);
  }
  await ctx.close();
}
await browser.close();
report(problems, `${expectedRows.length} ruled rows, a captioned price and its own ghost action per tier, equal styles, provisional note under the lede (${cms.salesOpen ? 'sales open' : 'sales closed'} branch)`);
