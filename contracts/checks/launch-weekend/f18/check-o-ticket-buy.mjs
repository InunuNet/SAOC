#!/usr/bin/env node
// F18-A23 (R62 #2-#6, R81, F18b): the single-ticket buy screen /tickets/<slug>, measured at 1280 and 390. Skips with a note when no purchasable ticket renders (sales closed).
//   dates     -> every per-day label reads "Thu 23 Sept 2027" form (tokens.tickets.dayFormat.regex), no raw ISO date is visible or in an aria-label, each day carries <time datetime="YYYY-MM-DD">
//   Buy       -> disabled at quantity 0 WITH a visible reason tied by aria-describedby (text = the existing "Please select at least one ticket."), the reason goes once a ticket is chosen
//   total     -> [data-catalogue-total] reads "Total R..." (no "estimate", no zero cents), aria-live polite, holds the Buy button; "Provisional pricing" appears at most once in the form
//   label     -> the "Tickets per day" label is 14px, sentence case (text-transform none)
//   layout    -> first stepper sits above tokens.tickets.stepperMaxTop (hero compact, no card photo); hero no taller than heroMaxHeightPx
//   prices    -> any R price on the screen matches ^R\d+(\.\d{2})?$ with no ".00"
// Usage: NOS_REUSE_SERVER=1 NOS_BASE=http://localhost:3672 node --import tsx/esm contracts/checks/launch-weekend/f18/check-o-ticket-buy.mjs
import { main, openPage, withBrowser, T, fetchHtml } from './_lib.mjs';

const K = T.tickets;
const D = K.dayFormat;
const DAY = new RegExp(D.regex);
const ISO = new RegExp(D.isoRegex);

await main('F18-A23 ticket buy screen', async (r) => {
  const hub = await fetchHtml(K.routes.hub);
  const slugHref = [...hub.html.matchAll(/href="(\/tickets\/[a-z0-9-]+)"/g)].map((m) => m[1]).find((h) => !new RegExp(K.routes.slugExclude).test(h));
  if (!slugHref) { r.note('no /tickets/<slug> link on /tickets: skipped (render-level A24 carries the rules)'); return; }
  await withBrowser(async (browser) => {
    for (const [w, h] of [[1280, 800], [390, 844]]) {
      const tag = `${slugHref} @${w}`;
      const { ctx, page, status } = await openPage(browser, { width: w, height: h }, slugHref);
      if (status !== 200) { r.fail(`${tag}: HTTP ${status}`); await ctx.close(); continue; }
      const form = page.locator('form[data-nos-ticket-form]').first();
      if (!(await form.count())) { r.note(`${tag}: no purchase form (sales closed): skipped`); await ctx.close(); continue; }
      const m = await form.evaluate((f, k) => {
        const txt = (e) => (e.textContent ?? '').replace(/\s+/g, ' ').trim();
        const days = [...f.querySelectorAll('[data-day-row], fieldset [role="group"][aria-label]')].map((g) => ({ aria: g.getAttribute('aria-label') ?? '', text: txt(g), time: [...g.querySelectorAll('time')].map((t) => t.getAttribute('datetime')) }));
        const legend = [...f.querySelectorAll('legend')].find((l) => /tickets per day/i.test(l.textContent ?? ''));
        const lcs = legend ? getComputedStyle(legend) : null;
        const buy = f.querySelector('button[type="submit"]');
        const describedBy = buy?.getAttribute('aria-describedby') ?? '';
        const hint = describedBy ? describedBy.split(/\s+/).map((id) => document.getElementById(id)).filter(Boolean) : [];
        const total = f.querySelector(k.totalSel);
        const firstStep = f.querySelector('button[aria-label^="Increase quantity"]');
        const hero = document.querySelector('[data-nos-hero]');
        return {
          days, legend: legend ? { text: txt(legend), px: parseFloat(lcs.fontSize), tt: lcs.textTransform } : null,
          buyDisabled: !!buy?.disabled, describedBy, hintText: hint.map(txt).join(' '), hintVisible: hint.some((e) => e.getBoundingClientRect().height > 0 && getComputedStyle(e).visibility !== 'hidden'),
          total: total ? { text: txt(total), live: total.closest('[aria-live]')?.getAttribute('aria-live') ?? total.getAttribute('aria-live'), hasBuy: !!total.querySelector('button[type="submit"]') } : null,
          prov: (txt(f).match(/Provisional pricing/g) ?? []).length,
          prices: [...f.querySelectorAll('[data-ticket-price]')].map(txt),
          stepTop: firstStep ? firstStep.getBoundingClientRect().top + scrollY : null,
          heroH: hero ? hero.getBoundingClientRect().height : null,
          text: txt(f),
        };
      }, { totalSel: '[data-catalogue-total]' });
      for (const d of m.days) {
        const label = d.aria || d.text;
        if (!DAY.test(d.aria) && !DAY.test(d.text.replace(/\s*(Decrease|Increase|Quantity).*$/, ''))) r.fail(`${tag}: day label "${label.slice(0, 50)}" is not the "Thu 23 Sept 2027" form`);
        if (ISO.test(d.aria) || ISO.test(d.text)) r.fail(`${tag}: a raw ISO date is visible or in an aria-label: "${(d.aria || d.text).slice(0, 50)}"`);
        if (!d.time.length || d.time.some((t) => !ISO.test(t ?? ''))) r.fail(`${tag}: a day row carries no <time datetime="YYYY-MM-DD">`);
      }
      if (m.legend) {
        if (Math.abs(m.legend.px - K.label.fontPx) > 0.5) r.fail(`${tag}: "Tickets per day" is ${m.legend.px}px, want ${K.label.fontPx}px`);
        if (m.legend.tt !== K.label.textTransform) r.fail(`${tag}: "Tickets per day" text-transform ${m.legend.tt}, want none (sentence case)`);
        if (m.legend.text !== K.label.text) r.fail(`${tag}: label reads "${m.legend.text}", want "${K.label.text}"`);
      }
      if (!m.buyDisabled) r.fail(`${tag}: Buy is enabled at quantity 0`);
      if (!m.describedBy || m.hintText !== T.tickets.buyHint.text) r.fail(`${tag}: the disabled Buy has no aria-describedby reason "${K.buyHint.text}" (got "${m.hintText}")`);
      if (m.describedBy && !m.hintVisible) r.fail(`${tag}: the Buy reason is not visible`);
      if (!m.total) r.fail(`${tag}: no [data-catalogue-total] beside Buy`);
      else {
        if (!/^Total\s*R\d+(\.\d{2})?\b/.test(m.total.text.replace(/Buy.*$/i, '').trim()) && !/Total\s*R\d/.test(m.total.text)) r.fail(`${tag}: the total block reads "${m.total.text.slice(0, 60)}", want "Total R..."`);
        if (/estimat/i.test(m.total.text)) r.fail(`${tag}: the total still says "estimate"`);
        if (/R\d+\.00\b/.test(m.total.text)) r.fail(`${tag}: the total carries zero cents`);
        if (m.total.live !== 'polite') r.fail(`${tag}: the total is not aria-live="polite" (${m.total.live})`);
        if (!m.total.hasBuy) r.fail(`${tag}: the Buy button is not inside the total block (total must sit next to Buy)`);
      }
      if (m.prov > 1) r.fail(`${tag}: "Provisional pricing" appears ${m.prov} times in the form, want at most once`);
      for (const p of m.prices) if (!new RegExp(K.priceRegex).test(p) || /\.00\b/.test(p)) r.fail(`${tag}: price "${p}" is not zero-cent-free R format`);
      if (m.stepTop !== null && m.stepTop > K.stepperMaxTop[String(w)]) r.fail(`${tag}: first stepper at y=${Math.round(m.stepTop)}, want <= ${K.stepperMaxTop[String(w)]} (compact hero, no card photo)`);
      if (m.heroH !== null && m.heroH > K.heroMaxHeightPx[String(w)]) r.fail(`${tag}: hero is ${Math.round(m.heroH)}px high, want <= ${K.heroMaxHeightPx[String(w)]}`);
      const inc = form.locator('button[aria-label^="Increase quantity"]').first();
      if (await inc.count()) {
        await inc.click();
        const after = await form.evaluate((f) => ({ disabled: !!f.querySelector('button[type="submit"]')?.disabled, text: (f.querySelector('[data-catalogue-total]')?.textContent ?? '').replace(/\s+/g, ' ') }));
        if (after.disabled) r.fail(`${tag}: Buy stays disabled after choosing a ticket`);
        if (!/Total\s*R[1-9]/.test(after.text)) r.fail(`${tag}: the total did not update after choosing a ticket ("${after.text.slice(0, 50)}")`);
      }
      await ctx.close();
    }
  });
});
