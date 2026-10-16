// F18-A9 (R77 #4, render level, no CMS, no server): TicketPurchaseForm rendered with goldens/f18/catalogue-fixtures.json produces the catalogue row vocabulary.
//   every fixture type -> one [data-catalogue-row] carrying its name, its price (expectPrice, formatRand style: R2000 / R200 / R250.50, never "R200.00"), its description, a stepper pair with
//                         aria-labels "Increase quantity of <name>" / "Decrease quantity of <name>"; the sold-out fixture shows "Sold out" and a disabled + (or no stepper)
//   form chrome        -> still form[data-nos-ticket-form], the legend, the sticky [data-catalogue-total] holding "Total" and the submit button with the buy label; no old "(estimate)" paragraph left outside it
//   no regression      -> a single requiresDaySelection type still hides the row stepper (the day picker owns quantity), exactly as before
// Run: pnpm exec tsx contracts/checks/launch-weekend/f18/check-i-catalogue-render.mts   (cwd = implementation worktree)
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { TicketPurchaseForm } from '../../../../components/tickets/TicketPurchaseForm';
import { readGolden, T } from './_lib.mjs';

const G = readGolden('catalogue-fixtures.json') as { soldOutMessage: string; buyButtonLabel: string; showDays: string[]; types: Record<string, unknown>[] };
const C = T.catalogue;
const problems: string[] = [];
const fail = (m: string) => problems.push(m);
const render = (types: Record<string, unknown>[]) => renderToStaticMarkup(createElement(TicketPurchaseForm as never, { ticketTypes: types, buyButtonLabel: G.buyButtonLabel, soldOutMessage: G.soldOutMessage, showDays: G.showDays }));
const txt = (h: string) => h.replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

const html = render(G.types);
if (!/data-nos-ticket-form/.test(html)) fail('form[data-nos-ticket-form] lost');
if (!/data-catalogue-rows/.test(html)) fail('no [data-catalogue-rows] container');
const rows = html.split(/(?=<[a-z0-9]+[^>]*data-catalogue-row[\s=>])/).filter((p) => /^<[a-z0-9]+[^>]*data-catalogue-row[\s=>]/.test(p));
if (rows.length !== G.types.length) fail(`want ${G.types.length} [data-catalogue-row], got ${rows.length}`);
G.types.forEach((t, i) => {
  const name = t.name as string;
  const row = rows[i] ?? '';
  const body = txt(row);
  if (!body.includes(name)) fail(`row ${i + 1}: name "${name}" missing`);
  const price = (t as { expectPrice: string }).expectPrice;
  if (!new RegExp(`${price.replace('.', '\\.')}(?![\\d.])`).test(body)) fail(`row ${i + 1} (${name}): price ${price} missing in "${body.slice(0, 120)}"`);
  if (/R\d+\.00\b/.test(body)) fail(`row ${i + 1} (${name}): price still carries ".00"`);
  if (!body.includes(t.description as string)) fail(`row ${i + 1} (${name}): description dropped`);
  const inc = `aria-label="${C.labels.increase} ${name}"`;
  const dec = `aria-label="${C.labels.decrease} ${name}"`;
  if (t.soldOut) {
    if (!body.includes(G.soldOutMessage)) fail(`row ${i + 1}: sold-out message missing`);
    const m = new RegExp(`<button[^>]*${inc.replace(/[()]/g, '\\$&')}[^>]*>`).exec(row);
    if (m && !/disabled/.test(m[0])) fail(`row ${i + 1}: the increase button of a sold-out row is enabled`);
  } else {
    if (!row.includes(inc) || !row.includes(dec)) fail(`row ${i + 1} (${name}): stepper aria-labels missing`);
  }
});
if (!/data-catalogue-total/.test(html)) fail('no [data-catalogue-total]');
else {
  const tot = txt(html.slice(html.indexOf('data-catalogue-total')));
  if (!tot.includes(C.labels.total)) fail(`the total block does not say "${C.labels.total}"`);
  if (/estimat/i.test(tot.split(G.buyButtonLabel)[0])) fail('the total block still says "estimate" (R62: one Total, no double estimate)');
  if (!/aria-live="polite"/.test(html.slice(html.indexOf('data-catalogue-total') - 400))) fail('the total is not in an aria-live="polite" region');
  if (!/type="submit"/.test(html.slice(html.indexOf('data-catalogue-total')))) fail('the submit button is not after the [data-catalogue-total] marker (it must sit inside the sticky total)');
  if (!tot.includes(G.buyButtonLabel)) fail('submit button lost the buy label');
}
if (/\(estimate\)|Estimated total/.test(html)) fail('the old "Estimated total ... (estimate)" wording still renders');

const day = render([{ ...G.types[0], requiresDaySelection: true }]);
if (new RegExp(`aria-label="${C.labels.increase} `).test(day)) fail('a single requiresDaySelection type shows a row stepper again (the day picker owns quantity)');

if (problems.length) { console.error(`FAIL F18-A9 (${problems.length}):\n- ${problems.join('\n- ')}`); process.exit(1); }
console.log('PASS F18-A9 catalogue rows (render level)');
