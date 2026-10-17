#!/usr/bin/env node
// F18-A37 (F18b commit 4, design-cb rotation rulings 1-3): /national-show/conferences measured at 1280 and 390.
//  lede     -> the hero lede is exactly "Register for the National Orchid Show Symposium or the WOSA Conference." (the old "combined SAOC/WOSA Joint track" clause stated something
//              false and is gone: no "Joint", no "SAOC Symposium" anywhere in main or the meta description)
//  R11 card -> no .nos-surface in main holds only a chip: after the "To be confirmed" chip text is removed at least 4 words of an existing sentence remain, else the card must not exist
//              (no R11 card without a sentence, no ~120px of empty surface)
//  cards    -> every ticket card (article[id^="ticket-"]) carries the v13 shadow (box-shadow not none) and no 1px border (R17); every price is whole rand ("R2000": no ".00", no decimals)
//  Buy      -> where a quantity form renders, Buy is ENABLED at quantity 0 and a click shows exactly "Choose at least one ticket" inline (vote 2B)
//  total    -> where a total renders it reads "Estimated total" exactly once, with no "(ESTIMATE)" suffix and no "R0.00"
//  index    -> the full Explore index renders and no mini "Explore the show" list does (rotation ruling 4)
// Skips the sales-dependent parts with a note while sales are closed (no cards, no form).
// Usage: NOS_REUSE_SERVER=1 NOS_BASE=http://localhost:3672 node --import tsx/esm contracts/checks/launch-weekend/f18/check-aa-conferences-live.mjs
import { readFileSync } from 'node:fs';
import { main, openPage, withBrowser, fetchHtml, flat } from './_lib.mjs';

const C = JSON.parse(readFileSync('.agent/memory/project/specs/launch-weekend/goldens/f18b/v13-copy.json', 'utf8'));
const LEDE = C.strings.conferencesLede;
const HINT = C.strings.buyHint;
const ROUTE = '/national-show/conferences';
const CHIP = /to be confirmed/gi;

function measure() {
  const q = (s, r = document) => r.querySelector(s);
  const qa = (s, r = document) => [...r.querySelectorAll(s)];
  const t = (e) => (e?.textContent ?? '').replace(/\s+/g, ' ').trim();
  const main = q('main');
  const hero = q('[data-nos-hero]');
  const heroText = t(hero);
  const idx = q('nav[aria-label="Explore the show pages"]');
  const buy = qa('main button').find((b) => /^buy/i.test(t(b)));
  return {
    heroText,
    mainText: t(main),
    surfaces: qa('main .nos-surface').map((e) => ({ text: t(e), h: e.getBoundingClientRect().height })),
    cards: qa('main article[id^="ticket-"]').map((c) => { const s = getComputedStyle(c); return { id: c.id, shadow: s.boxShadow, border: parseFloat(s.borderTopWidth), text: t(c) }; }),
    buy: buy ? { disabled: buy.disabled || buy.getAttribute('aria-disabled') === 'true' } : null,
    totals: qa('main [data-catalogue-total]').map(t),
    mini: qa('main [data-nos-holding-cards]').length + qa('main h2, main h3, main p, main span').filter((e) => t(e).toLowerCase() === 'explore the show' && !e.closest('nav[aria-label="Explore the show pages"]')).length,
    index: !!idx,
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  };
}

await main('F18-A37 conferences page', async (r) => {
  const { status, html } = await fetchHtml(ROUTE);
  if (status !== 200) { r.fail(`${ROUTE}: HTTP ${status}`); return; }
  const meta = /<meta[^>]+name="description"[^>]+content="([^"]*)"/.exec(html)?.[1] ?? '';
  if (/SAOC Symposium|Joint/.test(meta)) r.fail(`${ROUTE}: the meta description still names "SAOC Symposium" or a Joint track: "${meta}"`);
  await withBrowser(async (browser) => {
    for (const [name, w, h] of [['1280', 1280, 900], ['390', 390, 844]]) {
      const { ctx, page } = await openPage(browser, { width: w, height: h }, ROUTE, { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle');
      const m = await page.evaluate(measure);
      const tag = `${ROUTE} @${name}`;
      if (m.overflow > 1) r.fail(`${tag}: horizontal overflow ${m.overflow}px`);
      if (!flat(m.heroText).includes(flat(LEDE))) r.fail(`${tag}: the hero lede is not "${LEDE}"`);
      if (/Joint/.test(m.mainText)) r.fail(`${tag}: a "Joint" track fragment renders (no combined track exists)`);
      if (/SAOC Symposium/.test(m.mainText)) r.fail(`${tag}: "SAOC Symposium" renders (the product is National Orchid Show Symposium)`);
      for (const s of m.surfaces) {
        const rest = s.text.replace(CHIP, ' ').replace(/\s+/g, ' ').trim();
        if (CHIP.test(s.text) || /to be confirmed/i.test(s.text)) if (rest.split(' ').filter(Boolean).length < 4) r.fail(`${tag}: an R11 card holds only a chip (${Math.round(s.h)}px of surface, "${s.text.slice(0, 40)}"): give it an existing sentence or drop the card`);
        CHIP.lastIndex = 0;
      }
      if (!m.index) r.fail(`${tag}: the full Explore index is missing`);
      if (m.mini) r.fail(`${tag}: ${m.mini} mini "Explore the show" list/cards render beside the full index`);
      if (!m.cards.length) { if (name === '1280') r.note(`${tag}: no ticket cards (sales closed or no conference types): card, Buy and total rules not measured`); await ctx.close(); continue; }
      for (const c of m.cards) {
        if (!c.shadow || c.shadow === 'none') r.fail(`${tag} ${c.id}: no card shadow (the v13 shadow is required, R17)`);
        if (c.border >= 1) r.fail(`${tag} ${c.id}: a ${c.border}px border (R17: the v13 shadow, not a 1px olive border)`);
        for (const price of c.text.match(/R\s?\d[\d\s,]*(?:\.\d+)?/g) ?? []) if (/\.\d/.test(price)) r.fail(`${tag} ${c.id}: price "${price.trim()}" has decimals (whole rand, e.g. R2000)`);
      }
      if (m.totals.length) {
        const t = m.totals.join(' | ');
        const n = (t.match(/Estimated total/g) ?? []).length;
        if (n !== m.totals.length) r.fail(`${tag}: "Estimated total" appears ${n} times across ${m.totals.length} total block(s), want exactly once each`);
        if (/\(estimate\)/i.test(t)) r.fail(`${tag}: a total still carries the "(ESTIMATE)" suffix`);
        if (/R0\.00/.test(t)) r.fail(`${tag}: a total reads "R0.00"`);
        if (m.totals.length > 1) r.fail(`${tag}: ${m.totals.length} total blocks, want one`);
      }
      if (m.buy) {
        if (m.buy.disabled) r.fail(`${tag}: Buy is disabled at quantity 0 (vote 2B: enabled)`);
        else {
          await page.evaluate(() => { const b = [...document.querySelectorAll('main button')].find((x) => /^buy/i.test(x.textContent ?? '')); b?.click(); });
          const hint = await page.evaluate(() => (document.querySelector('[data-buy-hint]')?.textContent ?? '').replace(/\s+/g, ' ').trim());
          if (hint !== HINT) r.fail(`${tag}: pressing Buy at quantity 0 shows "${hint}", want exactly "${HINT}"`);
        }
      }
      await ctx.close();
    }
  });
});
