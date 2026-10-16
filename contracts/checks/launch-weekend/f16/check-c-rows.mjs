#!/usr/bin/env node
// A3: the Visit group as typographic rows (R31-A2), against the live render. One row per product family, one primary action per row
// (equal weight, >=50px, full width when stacked), prices = resolveEffectivePrice of each CMS product (dual where an early-bird
// sibling exists), no photograph anywhere in main, no FROM block, a single provisional note, no overflow at 390/1280/1920. When the
// live dataset has sales closed the closed branch is asserted instead (no price, no link, one notice); the closed path is ALSO proven
// without any CMS toggle by check-d-render.mts.
// Usage: node --import tsx/esm contracts/checks/launch-weekend/f16/check-c-rows.mjs
import { VIEWPORTS, HUB, SEL, launch, newPage, openPath, loadGolden, readCms, report } from './_lib.mjs';
import { resolveEffectivePrice } from '../../../../lib/checkout-reservation.ts';

// The early-bird SKU -> standard SKU pairing (ticketing-flow-redesign golden), restated here so the check does not import the code under test.
const REGULAR_PRICE_SIBLING_SLUG = { 'weekend-pass-early-bird': 'weekend-pass', 'early-bird': 'day-visitor' };
const T = loadGolden('tokens.json').row;
const cms = await readCms();
const problems = [];
const bySlug = new Map(cms.types.map((t) => [t.slug, t]));
const expectedRows = cms.types.filter((t) => !(t.slug in REGULAR_PRICE_SIBLING_SLUG && bySlug.has(REGULAR_PRICE_SIBLING_SLUG[t.slug])));
const eff = (t) => resolveEffectivePrice({ price: t.price, regularPrice: t.regularPrice ?? null, earlyBirdCutoff: t.earlyBirdCutoff ?? null, now: new Date() });
const fmt = (n) => (Number.isInteger(n) ? `R${n}` : `R${n.toFixed(2)}`);

const browser = await launch();
for (const vp of VIEWPORTS) {
  const { ctx, page } = await newPage(browser, vp);
  await openPath(page, HUB);
  const tag = `@${vp.name}`;
  const m = await page.evaluate(({ SEL }) => {
    const visit = document.getElementById('visit');
    if (!visit) return { error: 'no #visit group' };
    const fam = (e) => getComputedStyle(e).fontFamily.split(',')[0].replace(/["']/g, '').toLowerCase();
    const rows = [...visit.querySelectorAll(SEL.row)].map((li) => {
      const r = li.getBoundingClientRect();
      const name = li.querySelector(SEL.rowName);
      const act = [...li.querySelectorAll(SEL.action)];
      const tiers = [...li.querySelectorAll(SEL.tier)].map((t) => { const p = t.querySelector(SEL.price); const pr = p && p.getBoundingClientRect(); return { kind: t.getAttribute('data-ticket-tier'), caption: t.querySelector('dt')?.textContent.trim(), price: p?.textContent.trim(), size: p ? parseFloat(getComputedStyle(p).fontSize) : 0, fam: p ? fam(p) : '', bottom: pr ? pr.bottom : 0, capSize: parseFloat(getComputedStyle(t.querySelector('dt')).fontSize) }; });
      const a = act[0]; const ar = a && a.getBoundingClientRect(); const cs = a && getComputedStyle(a);
      return { h: r.height, w: r.width, name: name?.textContent.trim(), nameFam: name ? fam(name) : '', nameSize: name ? parseFloat(getComputedStyle(name).fontSize) : 0, nameWeight: name ? Number(getComputedStyle(name).fontWeight) : 0, actions: act.length, href: a?.getAttribute('href'), text: a?.textContent.trim(), ah: ar?.height, aw: ar?.width, atop: ar?.top, style: cs && [cs.backgroundColor, cs.color, cs.fontSize, cs.fontWeight].join('|'), tiers, dayNote: !!li.querySelector(SEL.dayNote) };
    });
    const media = [...document.querySelectorAll('main img, main picture, main svg, main canvas, main video')].filter((e) => !e.closest('[aria-hidden="true"]')).length;
    const bg = [...document.querySelectorAll('main *')].filter((e) => /url\(/.test(getComputedStyle(e).backgroundImage)).length;
    const text = visit.innerText;
    return { rows, media, bg, hasFrom: /(^|\n)\s*from\s*(\n|$)/i.test(text), prices: /\bR\s?\d/.test(text), links: [...visit.querySelectorAll('a[href^="/tickets/"]')].length, closed: visit.querySelectorAll(SEL.closed).length, provisional: (text.match(/Provisional pricing/g) || []).length, overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1 };
  }, { SEL });
  if (m.error) { problems.push(`${tag}: ${m.error}`); await ctx.close(); continue; }
  if (m.media || m.bg) problems.push(`${tag}: ${m.media} media element(s) and ${m.bg} background image(s) in main, want none (typographic, no stock photos)`);
  if (m.hasFrom) problems.push(`${tag}: the orphan FROM price block still renders`);
  if (m.overflow) problems.push(`${tag}: horizontal overflow`);
  if (m.rows.length !== expectedRows.length) problems.push(`${tag}: ${m.rows.length} rows, want ${expectedRows.length} (one per product family)`);
  if (cms.salesOpen) {
    if (m.provisional !== 1) problems.push(`${tag}: ${m.provisional} provisional notes in the Visit group, want exactly 1`);
    if (m.links !== m.rows.length) problems.push(`${tag}: ${m.links} /tickets/ links for ${m.rows.length} rows (button wall: want exactly one action per row)`);
    const styles = new Set();
    for (const r of m.rows) {
      const t = `${tag} row "${r.name}"`;
      if (r.actions !== 1) problems.push(`${t}: ${r.actions} actions, want exactly 1`);
      if (!/^\/tickets\/[a-z0-9-]+$/.test(r.href || '') || !bySlug.has((r.href || '').split('/').pop())) problems.push(`${t}: action href ${r.href} is not a live /tickets/<slug>`);
      if (!new RegExp(`^${cms.page.buyButtonLabel || T.actionLabelFallback}`).test(r.text || '')) problems.push(`${t}: action reads "${r.text}", want the buy label`);
      if ((r.ah || 0) < T.actionMinHeight - 0.5) problems.push(`${t}: action is ${(r.ah || 0).toFixed(1)}px tall, want >=${T.actionMinHeight}`);
      styles.add(r.style);
      if (vp.width < T.stackBelow && Math.abs(r.aw - (r.w)) > 2) problems.push(`${t}: stacked action is ${r.aw?.toFixed(0)}px wide in a ${r.w.toFixed(0)}px row, want full width`);
      if (vp.width < T.stackBelow && r.tiers.length && r.atop < Math.max(...r.tiers.map((x) => x.bottom))) problems.push(`${t}: stacked action is not below the prices`);
      if (r.nameFam !== 'fraunces' && !/fraunces/.test(r.nameFam)) problems.push(`${t}: name font ${r.nameFam}, want Fraunces`);
      if (r.nameWeight !== 400 || Math.abs(r.nameSize - T.nameRole.sizePx) > T.nameRole.tolerance) problems.push(`${t}: name is ${r.nameWeight} ${r.nameSize}px, want 400 ${T.nameRole.sizePx}px (R35 card-title role)`);
      if (vp.width >= T.stackBelow && r.h > T.maxRowHeight1280) problems.push(`${t}: row is ${r.h.toFixed(0)}px tall, want <=${T.maxRowHeight1280}`);
      if (r.tiers.length === 0) problems.push(`${t}: no price while sales are open`);
      r.tiers.forEach((x, i) => {
        if (i === 0 && (x.size < T.priceDominantMinPx - 0.5 || x.size > T.priceDominantMaxPx + 0.5)) problems.push(`${t}: dominant price is ${x.size}px, want ${T.priceDominantMinPx}-${T.priceDominantMaxPx}`);
        if (i > 0 && Math.abs(x.size - T.priceSecondaryPx) > 0.5) problems.push(`${t}: secondary price is ${x.size}px, want ${T.priceSecondaryPx}`);
        if (x.capSize < T.captionPx - 0.1) problems.push(`${t}: caption ${x.capSize}px < ${T.captionPx}`);
        if (!/fraunces/.test(x.fam)) problems.push(`${t}: price font ${x.fam}, want Fraunces`);
      });
    }
    if (styles.size > 1) problems.push(`${tag}: row actions differ in weight (${[...styles].join(' vs ')}), want one grammar`);
    // Prices: each product's effective price shows against its own CMS name; dual where a sibling exists.
    const shown = new Map();
    for (const r of m.rows) for (const x of r.tiers) shown.set(x.caption, x.price);
    for (const t of cms.types) {
      const p = eff(t);
      if (p === null) continue;
      if (shown.get(t.name) !== fmt(p)) problems.push(`${tag}: "${t.name}" shows ${shown.get(t.name) ?? 'nothing'}, resolveEffectivePrice says ${fmt(p)}`);
    }
    for (const r of m.rows) {
      const slugOfRow = cms.types.find((t) => t.name === r.name)?.slug;
      const hasEarly = Object.entries(REGULAR_PRICE_SIBLING_SLUG).some(([early, std]) => std === slugOfRow && bySlug.has(early));
      if (hasEarly && r.tiers.length !== 2) problems.push(`${tag} row "${r.name}": ${r.tiers.length} price tier(s), want early-bird and standard`);
    }
    const dayCms = cms.types.filter((t) => t.requiresDaySelection).length;
    if (dayCms && !m.rows.some((r) => r.dayNote)) problems.push(`${tag}: day-choice note missing on the day rows`);
  } else {
    if (m.prices || m.links) problems.push(`${tag}: sales closed but ${m.prices ? 'a price' : ''} ${m.links ? 'a ticket link' : ''} renders`);
    if (m.closed !== 1) problems.push(`${tag}: ${m.closed} closed notices, want exactly 1`);
  }
  await ctx.close();
}
await browser.close();
report(problems, `${expectedRows.length} ruled rows, one action each, prices from resolveEffectivePrice, no photographs, no FROM block (${cms.salesOpen ? 'sales open' : 'sales closed'} branch)`);
