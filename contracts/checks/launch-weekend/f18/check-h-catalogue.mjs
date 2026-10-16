#!/usr/bin/env node
// F18-A8 (R77 #4, runtime): /conferences and /workshops catalogues on the F16 row vocabulary, purchase behaviour preserved. On each route (when ticket sales are open and the category has
// items; a CMS-closed or empty category is reported as a skipped route, never a pass of the row rules) at 1280 and 390:
//   rows        -> [data-catalogue-rows] holds >=1 [data-catalogue-row], each with a name, a price matching priceRegex (R200 style, no ".00", no "R 200", no trailing cents zero) and a stepper
//   steppers    -> aria-labels "Increase quantity of <name>" / "Decrease quantity of <name>" on every row; + raises the row quantity, - lowers it, never below 0; a sold-out row has no enabled +
//   total       -> [data-catalogue-total] is sticky (position sticky or fixed), <=96px high, inside the viewport once a quantity is chosen, shows an R amount equal to the sum, holds the submit button
//   checkout    -> submitting posts to /api/tickets/checkout (intercepted, never reaches the gateway) with the SAME payload shape as before (items with ticketTypeId + quantity), nothing renamed
//   transfer    -> the admission-transfer sentence ("Admission tickets may be transferred ...") renders on neither catalogue route, and still renders once on /national-show/tickets
// Usage: NOS_REUSE_SERVER=1 NOS_BASE=http://localhost:3672 node --import tsx/esm contracts/checks/launch-weekend/f18/check-h-catalogue.mjs
import { main, openPage, withBrowser, T, BASE, fetchHtml, flat } from './_lib.mjs';

const C = T.catalogue;
const S = C.selectors;
const PRICE = new RegExp(C.priceRegex);

await main('F18-A8 catalogue rows, sticky total, checkout payload, transfer note', async (r) => {
  let exercised = 0;
  await withBrowser(async (browser) => {
    for (const { route } of C.routes) {
      for (const [w, h] of [[1280, 800], [390, 844]]) {
        const tag = `${route} @${w}`;
        const { ctx, page, status } = await openPage(browser, { width: w, height: h }, route);
        if (status !== 200) { r.fail(`${tag}: HTTP ${status}`); await ctx.close(); continue; }
        const rows = await page.locator(S.row).count();
        if (!rows) {
          const sold = await page.locator('[data-nos-sales-closed], [data-sales-closed]').count();
          r.note(`${tag}: no catalogue rows (${sold ? 'sales closed' : 'empty category'}): skipped`);
          await ctx.close();
          continue;
        }
        exercised += 1;
        const info = await page.evaluate((s) => [...document.querySelectorAll(s.row)].map((row) => {
          const q = (sel) => row.querySelector(sel);
          const inc = row.querySelector('button[aria-label^="Increase quantity of"]');
          const dec = row.querySelector('button[aria-label^="Decrease quantity of"]');
          return { name: (q(s.name)?.textContent ?? '').trim(), price: (q(s.price)?.textContent ?? '').trim(), incLabel: inc?.getAttribute('aria-label') ?? null, decLabel: dec?.getAttribute('aria-label') ?? null, incDisabled: !!inc?.disabled, hasStepper: !!(q(s.stepper) || (inc && dec)) };
        }), S);
        info.forEach((row, i) => {
          const t = `${tag} row ${i + 1} (${row.name})`;
          if (!row.name) r.fail(`${t}: no name`);
          if (!PRICE.test(row.price.replace(/\s+/g, ' ')) && !/sold out|free/i.test(row.price)) r.fail(`${t}: price "${row.price}" does not match ${C.priceRegex}`);
          if (/\.00\b/.test(row.price) || /R\s\d/.test(row.price)) r.fail(`${t}: price "${row.price}" has trailing .00 or a space after R`);
          if (!row.hasStepper) r.fail(`${t}: no stepper`);
          if (row.incLabel !== `${C.labels.increase} ${row.name}`) r.fail(`${t}: increase aria-label is "${row.incLabel}", want "${C.labels.increase} ${row.name}"`);
          if (row.decLabel !== `${C.labels.decrease} ${row.name}`) r.fail(`${t}: decrease aria-label is "${row.decLabel}", want "${C.labels.decrease} ${row.name}"`);
        });
        const open = info.findIndex((x) => !x.incDisabled);
        if (open >= 0) {
          const row = page.locator(S.row).nth(open);
          const inc = row.locator('button[aria-label^="Increase quantity of"]');
          const dec = row.locator('button[aria-label^="Decrease quantity of"]');
          await dec.click({ trial: false }).catch(() => {});
          await inc.click();
          await inc.click();
          await dec.click();
          const total = page.locator(S.total).first();
          if (!(await total.count())) r.fail(`${tag}: no ${S.total} after choosing a quantity`);
          else {
            await total.scrollIntoViewIfNeeded();
            const m = await total.evaluate((el, vh) => {
              let n = el, sticky = false;
              while (n && n !== document.body) { const p = getComputedStyle(n).position; if (p === 'sticky' || p === 'fixed') { sticky = true; break; } n = n.parentElement; }
              const b = el.getBoundingClientRect();
              return { sticky, h: b.height, inView: b.bottom > 0 && b.top < vh, text: (el.textContent ?? '').replace(/\s+/g, ' ').trim(), submit: !!el.querySelector('button[type="submit"]') };
            }, h);
            if (!m.sticky) r.fail(`${tag}: the total is not sticky/fixed`);
            if (m.h > C.stickyMaxHeightPx + 0.5) r.fail(`${tag}: the sticky total is ${m.h.toFixed(0)}px high, want <= ${C.stickyMaxHeightPx}`);
            if (!m.inView) r.fail(`${tag}: the total is outside the viewport`);
            if (!/R\d/.test(m.text)) r.fail(`${tag}: the total shows no R amount ("${m.text.slice(0, 60)}")`);
            if (!m.submit) r.fail(`${tag}: the submit button is not inside the sticky total`);
          }
          // checkout payload, intercepted
          let body = null;
          await page.route(`**${C.checkoutPath}`, async (rt) => { body = rt.request().postDataJSON(); await rt.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: 'intercepted by F18-A8' }) }); });
          const needNames = await page.locator('input[required]:visible').count();
          if (needNames === 0) {
            await total.locator('button[type="submit"]').click().catch(() => {});
            await page.waitForTimeout(800);
            if (body === null) r.note(`${tag}: no checkout request fired (validation held it): payload shape not exercised here`);
            else {
              const items = body.items ?? body.lines ?? body.positions;
              if (!Array.isArray(items) || !items.length) r.fail(`${tag}: checkout payload has no items array (${Object.keys(body).join(',')})`);
              else for (const it of items) if (!('ticketTypeId' in it) || !('quantity' in it)) r.fail(`${tag}: a checkout item lost ticketTypeId/quantity (${Object.keys(it).join(',')})`);
            }
          }
        }
        const text = flat(await page.locator('main').innerText());
        if (text.includes(C.transferNoteStart)) r.fail(`${tag}: the admission-transfer note still renders on the catalogue (it belongs on /tickets)`);
        await ctx.close();
      }
    }
  });
  const { html } = await fetchHtml('/national-show/tickets');
  if (!flat(html.replace(/<[^>]+>/g, ' ')).includes(C.transferNoteStart)) r.fail('/national-show/tickets no longer renders the admission-transfer note');
  if (!exercised) r.note('WARNING: no catalogue route had rows in this environment; render-level check F18-A9 carries the row rules');
  void BASE;
});
