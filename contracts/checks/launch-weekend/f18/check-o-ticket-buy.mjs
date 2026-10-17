#!/usr/bin/env node
// F18-A23 (R62, R81, vote 2, F18b, design-cb FINAL checkout ruling): the checkout step /tickets/<slug> (pinned), measured at 1280 and 390. Goldens: goldens/f18b/v13-checkout.json.
// Skips with a note when no purchasable ticket renders (sales closed). It renders TicketPurchaseForm and its BEHAVIOUR is unchanged (payload, server validation, test-mode banner, admin gating).
//   summary   -> exactly ONE [data-ticket-card][data-ticket-variant="summary"], after the hero and before the form, the same stub / name / price as the hub card, NO stepper, NO CTA, NO button; the stub sits on the right
//                when the card is >= 470px wide and the card is stacked (stub above the body) below that
//   day       -> a day-specific product has ONE .days fieldset (legend "Choose a day", native radios, cells >= 58px, labels "Thu 23 Sept 2027", <time datetime>); ?day=<iso> preselects that day; the weekend pass has none
//   quantity  -> ONE quantity stepper (buttons >= 44px, minus sign U+2212, input min 1); ?quantity=2 fills it; no per-day rows ([data-day-row]), no "Tickets per day", no 0 default; invalid input falls back (200)
//   total     -> [data-catalogue-total] under the stepper holds the CTA, aria-live polite, "Total R..." in one price format (no "R150.00", no "estimate")
//   CTA       -> reads "Continue to payment" with an arrow; ENABLED at quantity 0; a click there shows exactly "Choose at least one ticket" inline in [data-buy-hint] (tied by aria-describedby) and moves focus to it
//   provisional -> "Provisional pricing — subject to change", when the price is provisional, appears exactly once on the page, under the price inside the summary card (never also in the form), 14px / 500 / --ink-700
//   removed   -> no "Ticket types" eyebrow or box and no "Tickets per day" label anywhere
//   payload   -> the POST to /api/tickets/checkout is unchanged: body { showId, lineItems[] } with ticketType, attendeeName, attendeeEmail and an optional ISO chosenDay per ticket, an Idempotency-Key header;
//                the check fulfils the request with a 400 so nothing is reserved
// Usage: NOS_REUSE_SERVER=1 NOS_BASE=http://localhost:3672 node --import tsx/esm contracts/checks/launch-weekend/f18/check-o-ticket-buy.mjs
import { readFileSync } from 'node:fs';
import { main, openPage, withBrowser, T, findCheckout } from './_lib.mjs';

const K = T.tickets;
const D = K.dayFormat;
const DAY = new RegExp(D.regex);
const ISO = new RegExp(D.isoRegex);
const CO = JSON.parse(readFileSync('.agent/memory/project/specs/launch-weekend/goldens/f18b/v13-checkout.json', 'utf8'));
const FORM = 'form[data-nos-ticket-form]';
const QTY = K.buyHint.firstQuantityFieldSelector;

function readPage({ co, qty, ink }) {
  const txt = (e) => (e?.textContent ?? '').replace(/\s+/g, ' ').trim();
  const f = document.querySelector(co.formSel);
  const main = document.querySelector('main');
  const hero = document.querySelector('[data-nos-hero]');
  const summaries = [...document.querySelectorAll(co.summary.selector)];
  const sum = summaries[0];
  const follows = (x, y) => !!(x && y && (x.compareDocumentPosition(y) & Node.DOCUMENT_POSITION_FOLLOWING));
  const rc = (e) => e.getBoundingClientRect();
  const stub = sum?.querySelector('[data-ticket-stub]');
  const body = sum?.querySelector('[data-ticket-body]');
  const priceEl = sum?.querySelector('[data-ticket-price]');
  const prov = [...document.querySelectorAll('main *')].filter((e) => !e.children.length && txt(e).includes(co.provisional.text));
  const probe = document.createElement('span');
  probe.style.cssText = `position:absolute;visibility:hidden;color:var(${co.provisional.colourVar})`;
  // The probe must sit inside the .nos-theme scope (where --ink-700 is the NOS ink, rgb(58,54,84)); under <main> alone it can resolve to the SAOC root token.
  (sum ?? main.closest('.nos-theme') ?? document.querySelector('.nos-theme') ?? main).appendChild(probe);
  const inkRgb = getComputedStyle(probe).color;
  probe.remove();
  const buy = f?.querySelector('button[type="submit"]');
  const total = f?.querySelector(co.total.selector);
  const first = f?.querySelector(qty);
  const days = f ? [...f.querySelectorAll(`${co.form.dayFieldset} input[type="radio"]`)].map((i) => ({ value: i.value, checked: i.checked, h: (i.closest('label') ?? i).getBoundingClientRect().height, label: (i.closest('label')?.textContent ?? '').replace(/\s+/g, ' ').trim(), aria: i.getAttribute('aria-label') ?? i.closest('label')?.getAttribute('aria-label') ?? '', time: [...(i.closest('label') ?? document).querySelectorAll('time')].map((t) => t.getAttribute('datetime')) })) : [];
  const legend = f ? [...f.querySelectorAll(`${co.form.dayFieldset} legend`)].map(txt)[0] ?? null : null;
  const minus = f ? [...f.querySelectorAll('button')].filter((b) => !b.matches('[type="submit"]') && /fewer|decrease|minus/i.test((b.getAttribute('aria-label') ?? '') + txt(b))) : [];
  const stepBtns = f ? [...f.querySelectorAll('button')].filter((b) => !b.matches('[type="submit"]')) : [];
  return {
    hasForm: !!f,
    summaries: summaries.length, cardsOnPage: document.querySelectorAll('[data-ticket-card]').length,
    sum: sum ? {
      afterHero: follows(hero, sum), beforeForm: follows(sum, f),
      controls: sum.querySelectorAll('[data-ticket-stepper], [data-ticket-cta], button, input, form').length,
      hasStub: !!stub, hasName: !!sum.querySelector('[data-ticket-name]'), hasPrice: !!priceEl,
      width: rc(sum).width, stubRight: stub && body ? rc(stub).left > rc(body).left : null, stubAbove: stub && body ? rc(stub).bottom <= rc(body).top + 1 : null,
    } : null,
    prov: { count: prov.length, inSummary: prov.filter((e) => sum?.contains(e)).length, inForm: prov.filter((e) => f?.contains(e)).length, afterPrice: prov[0] && priceEl ? follows(priceEl, prov[0]) : null,
      px: prov[0] ? parseFloat(getComputedStyle(prov[0]).fontSize) : null, weight: prov[0] ? getComputedStyle(prov[0]).fontWeight : null, colourOk: prov[0] ? getComputedStyle(prov[0]).color === inkRgb : null },
    dayRows: document.querySelectorAll('[data-day-row]').length,
    mainText: txt(main),
    days, legend,
    minusTexts: minus.map(txt), stepBtnH: stepBtns.map((b) => { const r = rc(b); return Math.min(r.width, r.height); }),
    qty: first ? { value: first.value, min: first.getAttribute('min'), tag: first.tagName } : null,
    buy: buy ? { disabled: buy.disabled, text: txt(buy), describedBy: buy.getAttribute('aria-describedby') ?? '' } : null,
    total: total ? { text: txt(total), live: total.closest('[aria-live]')?.getAttribute('aria-live') ?? total.getAttribute('aria-live'), hasBuy: !!total.querySelector('button[type="submit"]'), top: rc(total).top } : null,
    stepTop: first ? rc(first).top + scrollY : null,
    heroH: hero ? rc(hero).height : null,
    prices: [...document.querySelectorAll('main [data-ticket-price]')].map(txt),
  };
}

await main('F18-A23 ticket checkout screen', async (r) => {
  const found = await findCheckout();
  if (!found) { r.note('no purchasable checkout page rendered: skipped (render-level A24 and A28 carry the rules)'); return; }
  const { route } = found;
  const arg = { co: { ...CO, formSel: FORM }, qty: QTY, ink: null };
  await withBrowser(async (browser) => {
    for (const [w, h] of [[1280, 800], [390, 844]]) {
      const tag = `${route} @${w}`;
      const { ctx, page, status } = await openPage(browser, { width: w, height: h }, route);
      if (status !== 200) { r.fail(`${tag}: HTTP ${status}`); await ctx.close(); continue; }
      if (!(await page.locator(FORM).count())) { r.note(`${tag}: no purchase form (sales closed): skipped`); await ctx.close(); continue; }
      const m = await page.evaluate(readPage, arg);
      // summary
      if (m.summaries !== 1) r.fail(`${tag}: ${m.summaries} summary ticket cards, want exactly 1 (${CO.summary.selector})`);
      else {
        const s = m.sum;
        if (m.cardsOnPage !== 1) r.fail(`${tag}: ${m.cardsOnPage} [data-ticket-card] on the page, want only the one summary card`);
        if (!s.afterHero) r.fail(`${tag}: the summary card is not under the hero`);
        if (!s.beforeForm) r.fail(`${tag}: the summary card is not before the form`);
        if (s.controls) r.fail(`${tag}: the summary card holds ${s.controls} stepper, CTA, button, input or form element(s); it is read-only`);
        if (!s.hasStub || !s.hasName || !s.hasPrice) r.fail(`${tag}: the summary card lacks its stub, name or price (stub ${s.hasStub}, name ${s.hasName}, price ${s.hasPrice})`);
        if (s.width >= CO.summary.horizontalFromContainerPx && s.stubRight === false) r.fail(`${tag}: the summary card is ${Math.round(s.width)}px wide but the stub is not on the right`);
        if (s.width < CO.summary.horizontalFromContainerPx && s.stubAbove === false) r.fail(`${tag}: the summary card is ${Math.round(s.width)}px wide, want it stacked with the stub above the body`);
      }
      // day picker
      if (m.dayRows) r.fail(`${tag}: ${m.dayRows} per-day [data-day-row] row(s); the per-day rows are removed (one quantity for the chosen day)`);
      for (const bad of CO.removed) if (m.mainText.includes(bad)) r.fail(`${tag}: "${bad}" is still on the page (removed by the design-cb ruling)`);
      if (m.days.length) {
        if (m.legend !== CO.form.dayLegend) r.fail(`${tag}: the day fieldset legend reads "${m.legend}", want "${CO.form.dayLegend}"`);
        if (m.days.filter((d) => d.checked).length !== 1) r.fail(`${tag}: ${m.days.filter((d) => d.checked).length} days checked, want exactly 1`);
        for (const d of m.days) {
          if (d.h < CO.form.dayCellMinPx - 1) r.fail(`${tag}: day cell ${d.value} is ${Math.round(d.h)}px high, want >= ${CO.form.dayCellMinPx}`);
          const lab = d.aria || d.label;
          if (!DAY.test(lab.replace(/\s*\d+ of \d+.*$/, '').trim()) && !DAY.test(lab)) r.fail(`${tag}: day label "${lab.slice(0, 50)}" is not the "Thu 23 Sept 2027" form`);
          if (ISO.test(d.aria) || ISO.test(d.label)) r.fail(`${tag}: a raw ISO date is visible or in an aria-label: "${(d.aria || d.label).slice(0, 50)}"`);
          if (!d.time.length || d.time.some((t) => !ISO.test(t ?? ''))) r.fail(`${tag}: day ${d.value} carries no <time datetime="YYYY-MM-DD">`);
        }
      }
      // stepper
      if (!m.qty) r.fail(`${tag}: no quantity input (${QTY})`);
      else if (m.qty.min !== String(CO.form.quantityMin)) r.fail(`${tag}: quantity min is ${JSON.stringify(m.qty.min)}, want "${CO.form.quantityMin}"`);
      if (!m.minusTexts.length) r.fail(`${tag}: no minus button found`);
      for (const t of m.minusTexts) if (t.includes('–') || t.includes('-')) r.fail(`${tag}: the minus button reads "${t}", want a real minus sign U+2212`);
      if (m.minusTexts.length && !m.minusTexts.some((t) => t.includes(CO.form.minus))) r.fail(`${tag}: no button carries the minus sign U+2212`);
      for (const b of m.stepBtnH) if (b < CO.form.stepperButtonMinPx - 1) r.fail(`${tag}: a stepper button is ${Math.round(b)}px, want >= ${CO.form.stepperButtonMinPx}`);
      // CTA and total
      if (!m.buy) r.fail(`${tag}: no submit button`);
      else {
        if (!m.buy.text.startsWith(CO.cta.text)) r.fail(`${tag}: the CTA reads "${m.buy.text}", want "${CO.cta.text}" with an arrow`);
        if (CO.cta.arrow && !/[→›»]/.test(m.buy.text) && !(await page.locator(`${FORM} button[type="submit"] svg`).count())) r.fail(`${tag}: the CTA carries no arrow`);
        if (m.buy.disabled) r.fail(`${tag}: the CTA is disabled (it stays enabled at quantity 0)`);
      }
      if (!m.total) r.fail(`${tag}: no ${CO.total.selector} beside the CTA`);
      else {
        if (!/Total\s*R\d/.test(m.total.text)) r.fail(`${tag}: the total block reads "${m.total.text.slice(0, 60)}", want "Total R..."`);
        if (/estimat/i.test(m.total.text)) r.fail(`${tag}: the total still says "estimate"`);
        if (/R\d+\.00\b/.test(m.total.text)) r.fail(`${tag}: the total carries zero cents (one price format, R150)`);
        if (m.total.live !== CO.total.live) r.fail(`${tag}: the total is not aria-live="${CO.total.live}" (${m.total.live})`);
        if (!m.total.hasBuy) r.fail(`${tag}: the CTA is not inside the total block (total sits beside the CTA)`);
        if (m.stepTop !== null && m.total.top < m.stepTop - 1) r.fail(`${tag}: the total is above the stepper, want it under it`);
      }
      for (const p of m.prices) if (!new RegExp(K.priceRegex).test(p) || /\.00\b/.test(p)) r.fail(`${tag}: price "${p}" is not zero-cent-free R format`);
      // provisional
      if (m.prov.count > CO.provisional.times) r.fail(`${tag}: "${CO.provisional.text}" appears ${m.prov.count} times, want exactly once`);
      if (m.prov.count === 1) {
        if (!m.prov.inSummary || m.prov.inForm) r.fail(`${tag}: the provisional note must sit in the summary card under the price, not in the form`);
        if (m.prov.afterPrice === false) r.fail(`${tag}: the provisional note is not under the price`);
        if (Math.abs(m.prov.px - CO.provisional.fontPx) > 0.5 || String(m.prov.weight) !== String(CO.provisional.fontWeight)) r.fail(`${tag}: the provisional note is ${m.prov.px}px / ${m.prov.weight}, want ${CO.provisional.fontPx}px / ${CO.provisional.fontWeight}`);
        if (m.prov.colourOk === false) r.fail(`${tag}: the provisional note is not ink-700 (${CO.provisional.colourVar})`);
      }
      if (m.stepTop !== null && m.stepTop > K.stepperMaxTop[String(w)]) r.fail(`${tag}: first quantity control at y=${Math.round(m.stepTop)}, want <= ${K.stepperMaxTop[String(w)]}`);
      if (m.heroH !== null && m.heroH > K.heroMaxHeightPx[String(w)]) r.fail(`${tag}: hero is ${Math.round(m.heroH)}px high, want <= ${K.heroMaxHeightPx[String(w)]}`);
      // vote 2: quantity 0 keeps the CTA enabled; a click shows the hint and moves focus to it
      await page.locator(QTY).first().fill('0');
      await page.locator(`${FORM} button[type="submit"]`).first().click();
      const after = await page.evaluate((s) => {
        const hint = document.querySelector(s.hint);
        const buy = document.querySelector('form[data-nos-ticket-form] button[type="submit"]');
        const ids = (buy?.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean);
        return { hintText: (hint?.textContent ?? '').replace(/\s+/g, ' ').trim(), tied: !!hint && ids.includes(hint.id), focusOnHint: !!hint && (document.activeElement === hint || hint.contains(document.activeElement)), disabled: !!buy?.disabled };
      }, { hint: CO.cta.hintSelector });
      if (after.disabled) r.fail(`${tag}: the CTA is disabled at quantity 0`);
      if (after.hintText !== CO.cta.hint) r.fail(`${tag}: after a click at quantity 0 the hint reads "${after.hintText}", want "${CO.cta.hint}"`);
      if (!after.tied) r.fail(`${tag}: the hint is not tied to the CTA by aria-describedby`);
      if (!after.focusOnHint) r.fail(`${tag}: focus did not move to the hint`);
      const inc = page.locator(`${FORM} button[aria-label="One more"], ${FORM} button[aria-label^="Increase quantity"]`).first();
      if (await inc.count()) {
        await inc.click();
        const t2 = await page.evaluate((s) => (document.querySelector(s)?.textContent ?? '').replace(/\s+/g, ' '), CO.total.selector);
        if (!/Total\s*R[1-9]/.test(t2)) r.fail(`${tag}: the total did not update after choosing a ticket ("${t2.slice(0, 50)}")`);
      }
      await ctx.close();
    }
    // the hub's choice reaches the form: quantity and day
    const pf = await openPage(browser, { width: 1280, height: 800 }, `${route}?quantity=2`);
    if (await pf.page.locator(FORM).count()) {
      const m2 = await pf.page.evaluate(readPage, arg);
      if (m2.qty?.value !== '2') r.fail(`${route}?quantity=2: the stepper holds ${JSON.stringify(m2.qty?.value)}, want "2"`);
      if (!/Total\s*R[1-9]/.test(m2.total?.text ?? '')) r.fail(`${route}?quantity=2: the screen did not open with a selection (${(m2.total?.text ?? '').slice(0, 50)})`);
      if (m2.days.length > 1) {
        const pick = m2.days[m2.days.length - 1].value;
        const dp = await openPage(browser, { width: 1280, height: 800 }, `${route}?quantity=2&${CO.form.dayParam}=${pick}`);
        const m3 = await dp.page.evaluate(readPage, arg);
        if (m3.days.find((d) => d.checked)?.value !== pick) r.fail(`${route}?day=${pick}: the day fieldset did not preselect ${pick} (checked ${m3.days.find((d) => d.checked)?.value})`);
        await dp.ctx.close();
      }
    }
    await pf.ctx.close();
    for (const bad of ['quantity=abc', 'quantity=-3', 'quantity=9999', `${CO.form.dayParam}=2020-01-01`]) {
      const bp = await openPage(browser, { width: 1280, height: 800 }, `${route}?${bad}`);
      if (bp.status !== 200) r.fail(`${route}?${bad}: HTTP ${bp.status}, want 200 (invalid input falls back)`);
      await bp.ctx.close();
    }
    // payload: unchanged. The POST is intercepted and answered 400, so nothing is reserved.
    const pctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const ppage = await pctx.newPage();
    const posts = [];
    await ppage.route('**/api/tickets/checkout', (rt) => { posts.push({ headers: rt.request().headers(), body: rt.request().postData() }); rt.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: 'fixture: request intercepted by F18-A23' }) }); });
    await ppage.goto(`${(await import('./_lib.mjs')).BASE}${route}?quantity=1`, { waitUntil: 'networkidle' });
    const names = ppage.locator(`${FORM} input[type="text"], ${FORM} input[autocomplete="name"]`);
    const mails = ppage.locator(`${FORM} input[type="email"]`);
    for (let i = 0; i < await names.count(); i += 1) await names.nth(i).fill('Fixture Attendee');
    for (let i = 0; i < await mails.count(); i += 1) await mails.nth(i).fill('fixture@example.com');
    await ppage.locator(`${FORM} button[type="submit"]`).first().click();
    await ppage.waitForTimeout(1200);
    if (!posts.length) r.note('the form did not POST in the fixture run (attendee fields not recognised?): payload shape not measured; the render-level A24 pins the builder');
    else {
      let body = null;
      try { body = JSON.parse(posts[0].body ?? 'null'); } catch { r.fail('the checkout POST body is not JSON'); }
      if (body) {
        const P = CO.payload;
        const keys = Object.keys(body).sort().join();
        if (keys !== [...P.bodyKeys].sort().join()) r.fail(`the checkout POST body keys are [${keys}], want [${[...P.bodyKeys].sort().join()}] (unchanged payload)`);
        if (!Array.isArray(body.lineItems) || !body.lineItems.length) r.fail('the checkout POST has no lineItems');
        else for (const li of body.lineItems) {
          const lk = Object.keys(li);
          for (const need of P.lineItemRequired) if (!(need in li)) r.fail(`a line item lacks "${need}" (unchanged payload)`);
          for (const k of lk) if (!P.lineItemKeys.includes(k)) r.fail(`a line item carries the new key "${k}"; the payload shape must not change`);
          if (li.chosenDay !== undefined && !ISO.test(li.chosenDay)) r.fail(`chosenDay "${li.chosenDay}" is not YYYY-MM-DD`);
          if (li.ticketType !== found.slug) r.fail(`ticketType is "${li.ticketType}", want the slug "${found.slug}"`);
        }
        if (!posts[0].headers['idempotency-key']) r.fail('the checkout POST carries no Idempotency-Key header');
        if (!/application\/json/.test(posts[0].headers['content-type'] ?? '')) r.fail('the checkout POST is not application/json');
      }
    }
    await pctx.close();
  });
});
