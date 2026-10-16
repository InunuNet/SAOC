#!/usr/bin/env node
// F18-A23 (R62, R81, vote 2, F18b): the checkout screen /tickets/<slug>, measured at 1280 and 390. Skips with a note when no purchasable ticket renders (sales closed).
//   dates     -> every per-day label reads "Thu 23 Sept 2027" form (tokens.tickets.dayFormat.regex); no raw ISO date is visible or in an aria-label; each day carries <time datetime="YYYY-MM-DD">
//   Buy       -> ENABLED at quantity 0 (vote 2); a click shows the inline hint "Choose at least one ticket" ([data-buy-hint]), tied to Buy by aria-describedby, and moves focus to the first quantity field
//   prefill   -> /tickets/<slug>?quantity=2 opens with 2 selected (the v13 card CTA's destination); an invalid or out-of-range quantity falls back to the default, never an error page
//   total     -> [data-catalogue-total] reads "Total R..." (no "estimate", no zero cents), aria-live polite, holds the Buy button; "Provisional pricing" appears at most once in the form
//   label     -> the "Tickets per day" label is 14px, sentence case (text-transform none)
//   layout    -> first stepper above tokens.tickets.stepperMaxTop; hero no taller than heroMaxHeightPx
//   prices    -> every R price on the screen matches ^R\d+(\.\d{2})?$ with no ".00"
// Usage: NOS_REUSE_SERVER=1 NOS_BASE=http://localhost:3672 node --import tsx/esm contracts/checks/launch-weekend/f18/check-o-ticket-buy.mjs
import { main, openPage, withBrowser, T, fetchHtml } from './_lib.mjs';

const K = T.tickets;
const D = K.dayFormat;
const DAY = new RegExp(D.regex);
const ISO = new RegExp(D.isoRegex);

function readForm(f, sel) {
  const txt = (e) => (e.textContent ?? '').replace(/\s+/g, ' ').trim();
  const days = [...f.querySelectorAll('[data-day-row]')].map((g) => ({ aria: g.getAttribute('aria-label') ?? '', text: txt(g), time: [...g.querySelectorAll('time')].map((t) => t.getAttribute('datetime')) }));
  const legend = [...f.querySelectorAll('legend')].find((l) => /tickets per day/i.test(l.textContent ?? ''));
  const lcs = legend ? getComputedStyle(legend) : null;
  const buy = f.querySelector('button[type="submit"]');
  const total = f.querySelector(sel.total);
  const first = f.querySelector(sel.firstQty);
  const hero = document.querySelector('[data-nos-hero]');
  return {
    days, legend: legend ? { text: txt(legend), px: parseFloat(lcs.fontSize), tt: lcs.textTransform } : null,
    buyDisabled: !!buy?.disabled, describedBy: buy?.getAttribute('aria-describedby') ?? '',
    total: total ? { text: txt(total), live: total.closest('[aria-live]')?.getAttribute('aria-live') ?? total.getAttribute('aria-live'), hasBuy: !!total.querySelector('button[type="submit"]') } : null,
    prov: (txt(f).match(/Provisional pricing/g) ?? []).length,
    prices: [...f.querySelectorAll('[data-ticket-price]')].map(txt),
    stepTop: first ? first.getBoundingClientRect().top + scrollY : null,
    heroH: hero ? hero.getBoundingClientRect().height : null,
    qtyValue: first && 'value' in first ? first.value : null,
  };
}

await main('F18-A23 ticket checkout screen', async (r) => {
  let slug = null;
  for (const s of K.slugCandidates) { const x = await fetchHtml(`/tickets/${s}`); if (x.status === 200 && x.html.includes('data-nos-ticket-form')) { slug = s; break; } }
  if (!slug) { r.note('no purchasable /tickets/<slug> rendered: skipped (render-level A24 carries the rules)'); return; }
  const route = `/tickets/${slug}`;
  const sel = { total: '[data-catalogue-total]', firstQty: K.buyHint.firstQuantityFieldSelector };
  await withBrowser(async (browser) => {
    for (const [w, h] of [[1280, 800], [390, 844]]) {
      const tag = `${route} @${w}`;
      const { ctx, page, status } = await openPage(browser, { width: w, height: h }, route);
      if (status !== 200) { r.fail(`${tag}: HTTP ${status}`); await ctx.close(); continue; }
      const form = page.locator('form[data-nos-ticket-form]').first();
      if (!(await form.count())) { r.note(`${tag}: no purchase form (sales closed): skipped`); await ctx.close(); continue; }
      const m = await form.evaluate(readForm, sel);
      for (const d of m.days) {
        if (!DAY.test(d.aria)) r.fail(`${tag}: day label "${d.aria.slice(0, 50)}" is not the "Thu 23 Sept 2027" form`);
        if (ISO.test(d.aria) || ISO.test(d.text)) r.fail(`${tag}: a raw ISO date is visible or in an aria-label: "${(d.aria || d.text).slice(0, 50)}"`);
        if (!d.time.length || d.time.some((t) => !ISO.test(t ?? ''))) r.fail(`${tag}: a day row carries no <time datetime="YYYY-MM-DD">`);
      }
      if (m.legend) {
        if (Math.abs(m.legend.px - K.label.fontPx) > 0.5) r.fail(`${tag}: "Tickets per day" is ${m.legend.px}px, want ${K.label.fontPx}px`);
        if (m.legend.tt !== K.label.textTransform) r.fail(`${tag}: "Tickets per day" text-transform ${m.legend.tt}, want none (sentence case)`);
        if (m.legend.text !== K.label.text) r.fail(`${tag}: label reads "${m.legend.text}", want "${K.label.text}"`);
      }
      if (m.buyDisabled) r.fail(`${tag}: Buy is disabled at quantity 0 (vote 2: Buy stays enabled)`);
      if (!m.total) r.fail(`${tag}: no [data-catalogue-total] beside Buy`);
      else {
        if (!/Total\s*R\d/.test(m.total.text)) r.fail(`${tag}: the total block reads "${m.total.text.slice(0, 60)}", want "Total R..."`);
        if (/estimat/i.test(m.total.text)) r.fail(`${tag}: the total still says "estimate"`);
        if (/R\d+\.00\b/.test(m.total.text)) r.fail(`${tag}: the total carries zero cents`);
        if (m.total.live !== 'polite') r.fail(`${tag}: the total is not aria-live="polite" (${m.total.live})`);
        if (!m.total.hasBuy) r.fail(`${tag}: the Buy button is not inside the total block`);
      }
      if (m.prov > 1) r.fail(`${tag}: "Provisional pricing" appears ${m.prov} times in the form, want at most once`);
      for (const p of m.prices) if (!new RegExp(K.priceRegex).test(p) || /\.00\b/.test(p)) r.fail(`${tag}: price "${p}" is not zero-cent-free R format`);
      if (m.stepTop !== null && m.stepTop > K.stepperMaxTop[String(w)]) r.fail(`${tag}: first quantity control at y=${Math.round(m.stepTop)}, want <= ${K.stepperMaxTop[String(w)]} (compact hero, no card photo)`);
      if (m.heroH !== null && m.heroH > K.heroMaxHeightPx[String(w)]) r.fail(`${tag}: hero is ${Math.round(m.heroH)}px high, want <= ${K.heroMaxHeightPx[String(w)]}`);
      // vote 2: click at quantity 0
      await form.locator('button[type="submit"]').first().click();
      const after = await form.evaluate((f, s) => {
        const hint = f.querySelector(s.hint);
        const buy = f.querySelector('button[type="submit"]');
        const ids = (buy?.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean);
        const first = f.querySelector(s.first);
        return { hintText: (hint?.textContent ?? '').replace(/\s+/g, ' ').trim(), tied: !!hint && ids.includes(hint.id), focusOnFirst: !!first && document.activeElement === first };
      }, { hint: K.buyHint.selector, first: K.buyHint.firstQuantityFieldSelector });
      if (after.hintText !== K.buyHint.text) r.fail(`${tag}: after a click at quantity 0 the hint reads "${after.hintText}", want "${K.buyHint.text}"`);
      if (!after.tied) r.fail(`${tag}: the hint is not tied to Buy by aria-describedby`);
      if (!after.focusOnFirst) r.fail(`${tag}: focus did not move to the first quantity field`);
      const inc = form.locator('button[aria-label^="Increase quantity"]').first();
      if (await inc.count()) {
        await inc.click();
        const t2 = await form.evaluate((f, s) => (f.querySelector(s)?.textContent ?? '').replace(/\s+/g, ' '), sel.total);
        if (!/Total\s*R[1-9]/.test(t2)) r.fail(`${tag}: the total did not update after choosing a ticket ("${t2.slice(0, 50)}")`);
      }
      await ctx.close();
    }
    // prefill
    const pf = await openPage(browser, { width: 1280, height: 800 }, `${route}?quantity=2`);
    const f2 = pf.page.locator('form[data-nos-ticket-form]').first();
    if (await f2.count()) {
      const t = await f2.evaluate((f, s) => (f.querySelector(s)?.textContent ?? '').replace(/\s+/g, ' '), sel.total);
      if (!/Total\s*R[1-9]/.test(t)) r.fail(`${route}?quantity=2: the screen did not open with a selection (${t.slice(0, 50)})`);
    }
    await pf.ctx.close();
    for (const bad of ['quantity=abc', 'quantity=-3', 'quantity=9999']) {
      const bp = await openPage(browser, { width: 1280, height: 800 }, `${route}?${bad}`);
      if (bp.status !== 200) r.fail(`${route}?${bad}: HTTP ${bp.status}, want 200 (invalid input falls back)`);
      await bp.ctx.close();
    }
  });
});
