#!/usr/bin/env node
// F18-A35 (F18b, design-cb sales-closed ruling, REPLACES the earlier "sales-closed state stands in place of the cards"): /national-show/tickets in BOTH modes against the live server.
//  salesOpen true : no [data-sales-status] line anywhere (the cards sell as before; A29 and A23 own that).
//  salesOpen false: the v13 cards STILL render (fan, sections, stubs, names, sub-ledes), each masked like pricePending (no price, stepper, CTA, input, form, price numeral); ONE page-level
//                   R11 status line [data-sales-status] (role status) after the hero and before the first card carrying the existing "Sales closed" string and a "Be the first to know" link;
//                   the pool banner is hidden; no TEST MODE banner; the fan shows no price (labels end ", sales closed"); no horizontal overflow at 1280 and 390.
// The mode is read from the page and the check NEVER mutates Sanity. The live dataset has sales open, so the closed branch is covered at render level (A27 builder, A28 salesClosed card and status line) and
// this check prints a note when it meets an open page. NOS_SALES_CLOSED=1 therefore means an operator-supplied salesOpen=false dataset AND NOS_SALES_CLOSED_STRICT=1 (a page that is not closed then FAILS);
// without STRICT, =1 on an open page is a recorded skip. NOS_SALES_CLOSED=0 FAILS a page that is closed.
// Usage: NOS_SALES_CLOSED=1 NOS_REUSE_SERVER=1 NOS_BASE=http://localhost:3672 node --import tsx/esm contracts/checks/launch-weekend/f18/check-y-sales-closed.mjs
import { readFileSync } from 'node:fs';
import { main, openPage, withBrowser, flat } from './_lib.mjs';

const D = '.agent/memory/project/specs/launch-weekend/goldens/f18b';
const K = JSON.parse(readFileSync(`${D}/v13-tokens.json`, 'utf8'));
const C = JSON.parse(readFileSync(`${D}/v13-copy.json`, 'utf8'));
const H = K.hooks;
const SC = C.strings.salesClosed;
const ROUTE = '/national-show/tickets';

function measure(a) {
  const q = (s, r = document) => r.querySelector(s);
  const qa = (s, r = document) => [...r.querySelectorAll(s)];
  const t = (e) => (e?.textContent ?? '').replace(/\s+/g, ' ').trim();
  const status = qa(a.salesStatus);
  const hero = q('[data-nos-hero]');
  const firstCard = q(a.card);
  const follows = (x, y) => !!(x && y && (x.compareDocumentPosition(y) & Node.DOCUMENT_POSITION_FOLLOWING));
  return {
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    statusCount: status.length,
    status: status[0] ? { text: t(status[0]), role: status[0].getAttribute('role'), links: qa('a', status[0]).map((l) => ({ text: t(l), href: l.getAttribute('href') })), afterHero: follows(hero, status[0]), beforeCard: follows(status[0], firstCard) } : null,
    cards: qa(a.card).map((c) => ({
      id: c.id, state: c.getAttribute('data-ticket-state'), name: t(q(a.name, c)),
      price: !!q(a.price, c), stepper: !!q(a.stepper, c), cta: !!q(a.cta, c), buttons: qa('button, input, form', c).length, numeral: /\bR\s?\d/.test(t(c)),
    })),
    fanLabels: qa(`${a.fan} ${a.fanLink}`).map((l) => l.getAttribute('aria-label') ?? t(l)),
    pool: qa(a.poolBanner).length,
    sections: ['thursday', 'passes', 'programme'].filter((id) => document.getElementById(id)).length,
    form: !!q('main form, main input[type="number"]'),
    banner: /TEST MODE|Ozow charges/i.test(document.body.innerText),
  };
}

await main('F18-A35 sales closed and open modes', async (r) => {
  await withBrowser(async (browser) => {
    for (const [name, w, h] of [['1280', 1280, 900], ['390', 390, 844]]) {
      const { ctx, page, status } = await openPage(browser, { width: w, height: h }, ROUTE, { waitUntil: 'domcontentloaded' });
      const tag = `${ROUTE} @${name}`;
      if (status !== 200) { r.fail(`${tag}: HTTP ${status}`); await ctx.close(); continue; }
      await page.waitForLoadState('networkidle');
      const m = await page.evaluate(measure, H);
      if (m.overflow > 1) r.fail(`${tag}: horizontal overflow ${m.overflow}px`);
      const closed = m.statusCount > 0;
      if (process.env.NOS_SALES_CLOSED === '1' && !closed) {
        if (process.env.NOS_SALES_CLOSED_STRICT === '1') r.fail(`${tag}: NOS_SALES_CLOSED_STRICT=1 but the page shows no ${H.salesStatus} line`);
        else if (name === '1280') r.note(`${tag}: NOS_SALES_CLOSED=1 but the dataset is open (checks never mutate Sanity): the closed branch is covered at render level by A27 and A28`);
      }
      if (process.env.NOS_SALES_CLOSED === '0' && closed) r.fail(`${tag}: NOS_SALES_CLOSED=0 but the page is in the sales-closed state`);
      if (!closed) {
        if (/sales closed/i.test(m.fanLabels.join(' '))) r.fail(`${tag}: open mode, but a fan label says sales closed`);
        if (m.cards.some((c) => c.state === 'salesClosed')) r.fail(`${tag}: open mode, but a card is salesClosed`);
        if (name === '1280') r.note(`${tag}: open mode (no ${H.salesStatus} line); the closed branch was not measured`);
        await ctx.close();
        continue;
      }
      if (m.statusCount !== 1) r.fail(`${tag}: ${m.statusCount} ${H.salesStatus} lines, want exactly 1`);
      const st = m.status;
      if (st.role !== 'status') r.fail(`${tag}: the status line has role ${JSON.stringify(st.role)}, want status`);
      if (!flat(st.text).includes(SC.label)) r.fail(`${tag}: the status line does not read "${SC.label}"`);
      if (!st.links.some((l) => flat(l.text).includes(SC.bandLink) && (l.href ?? '').startsWith('/'))) r.fail(`${tag}: the status line has no "${SC.bandLink}" link`);
      if (!st.afterHero) r.fail(`${tag}: the status line is not after the hero`);
      if (!st.beforeCard) r.fail(`${tag}: the status line is not before the first ticket card`);
      if (!m.cards.length) r.fail(`${tag}: no ticket cards render while sales are closed (the v13 cards still render, masked)`);
      if (m.sections < 1) r.fail(`${tag}: no #thursday, #passes or #programme section renders while closed`);
      for (const c of m.cards) {
        const t = `${tag} ${c.id}`;
        if (c.state !== 'salesClosed') r.fail(`${t}: state ${JSON.stringify(c.state)}, want salesClosed`);
        if (c.price) r.fail(`${t}: a price element renders while closed`);
        if (c.stepper) r.fail(`${t}: a stepper renders while closed`);
        if (c.cta) r.fail(`${t}: a CTA renders while closed`);
        if (c.buttons) r.fail(`${t}: ${c.buttons} button, input or form element(s) render while closed`);
        if (c.numeral) r.fail(`${t}: a price numeral (R...) renders while closed`);
        if (!c.name) r.fail(`${t}: the masked card lost its name`);
      }
      for (const l of m.fanLabels) if (!/, sales closed$/.test(l) || /\bR\s?\d/.test(l)) r.fail(`${tag}: fan label "${l}" must end ", sales closed" with no price`);
      if (m.pool) r.fail(`${tag}: the pool banner renders while closed (it is hidden)`);
      if (m.form) r.fail(`${tag}: a form or quantity input renders while closed`);
      if (m.banner) r.fail(`${tag}: a TEST MODE banner renders while closed`);
      await ctx.close();
    }
  });
});
