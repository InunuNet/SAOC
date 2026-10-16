#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-explicit-any -- fixture-driven check; component props are loosely typed on purpose */
// A4: render-level proof of lib/admission-rows.ts and components/tickets/AdmissionRows.tsx against goldens/f16/rows-fixtures.json.
// No server, no CMS: this is how the sales-closed path (and the early-bird window edges) are proven WITHOUT toggling live Sanity.
// Usage: node --import tsx/esm contracts/checks/launch-weekend/f16/check-d-render.mts
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { buildAdmissionRows } from '../../../../lib/admission-rows.ts';
import { TicketTypeCard } from '../../../../components/tickets/TicketTypeCard.tsx';
import { AdmissionRows } from '../../../../components/tickets/AdmissionRows.tsx';

const fx = JSON.parse(readFileSync('.agent/memory/project/specs/launch-weekend/goldens/f16/rows-fixtures.json', 'utf8'));
const problems: string[] = [];
const types = (c: { override?: Record<string, unknown>[]; drop?: string[] } = {}) =>
  fx.base.filter((t: { slug: string }) => !(c.drop ?? []).includes(t.slug)).map((t: { slug: string }) => ({ ...t, ...((c.override ?? []).find((o) => o.slug === t.slug) ?? {}) }));
const rowsFor = (c: { now?: string; override?: Record<string, unknown>[]; drop?: string[] } = {}) => buildAdmissionRows(types(c), { now: new Date(c.now ?? fx.now) });
const shape = (r: { tiers: { kind: string; slug: string; price: number }[] }) => JSON.stringify(r.tiers.map((t) => [t.kind, t.slug, t.price]));

const sib = rowsFor();
fx.cases.siblingPairs.expectRows.forEach((e: any, i: number) => {
  const r = sib[i];
  if (!r) return problems.push(`siblingPairs: row ${i + 1} (${e.key}) missing`);
  if (r.key !== e.key || r.name !== e.name || shape(r) !== JSON.stringify(e.tiers) || r.actionSlug !== e.actionSlug || r.requiresDaySelection !== e.requiresDaySelection) problems.push(`siblingPairs: row ${i + 1} is ${JSON.stringify(r)}, want ${JSON.stringify(e)}`);
});
if (sib.length !== fx.cases.siblingPairs.expectRows.length) problems.push(`siblingPairs: ${sib.length} rows, want ${fx.cases.siblingPairs.expectRows.length}`);
for (const k of ['cutoffOpenWithRegular', 'cutoffPassedWithRegular', 'earlyWithoutSibling']) {
  const c = fx.cases[k];
  const r = rowsFor(c).find((x) => x.key === c.expectRow.key);
  if (!r) { problems.push(`${k}: row ${c.expectRow.key} missing`); continue; }
  if (shape(r) !== JSON.stringify(c.expectRow.tiers)) problems.push(`${k}: tiers ${shape(r)}, want ${JSON.stringify(c.expectRow.tiers)}`);
  if ('earlyBirdEnds' in c.expectRow && r.earlyBirdEnds !== c.expectRow.earlyBirdEnds) problems.push(`${k}: earlyBirdEnds ${r.earlyBirdEnds}, want ${c.expectRow.earlyBirdEnds}`);
  if (c.expectRow.name && r.name !== c.expectRow.name) problems.push(`${k}: name ${r.name}, want ${c.expectRow.name}`);
}
const gone = fx.cases.cutoffPassedNoRegular;
if (rowsFor(gone).some((r) => r.key === gone.expectRowAbsent)) problems.push(`cutoffPassedNoRegular: a product checkout refuses (409) is still advertised`);

const html = (rows: unknown, salesOpen: boolean) => renderToStaticMarkup(createElement(AdmissionRows as any, { rows, salesOpen, buyLabel: 'Buy Ticket' }));
const closed = html(sib, false);
if (/R\s?\d/.test(closed)) problems.push('closed: a price renders while sales are closed');
if (/href="\/tickets\//.test(closed)) problems.push('closed: a ticket link renders while sales are closed');
if (/data-ticket-prices|data-ticket-row-action|Buy Ticket/.test(closed)) problems.push('closed: price or action markup renders while sales are closed');
if ((closed.match(/data-ticket-row=""/g) ?? []).length !== sib.length) problems.push('closed: the rows themselves must still list the products');
const open = html(sib, true);
if ((open.match(/data-ticket-row-action/g) ?? []).length !== sib.length) problems.push(`open: ${(open.match(/data-ticket-row-action/g) ?? []).length} actions for ${sib.length} rows, want one each`);
if (/<img|<svg|<picture|background-image/.test(open + closed)) problems.push('rows markup contains a photograph or graphic');
if (!/R120/.test(open) || !/R150/.test(open) || !/R360/.test(open) || !/R380/.test(open) || !/R300/.test(open)) problems.push('open: dual prices R120/R150 and R360/R380 and R300 not all rendered');
if (!/href="\/tickets\/early-bird"/.test(open) || /href="\/tickets\/day-visitor"/.test(open)) problems.push('open: the Day row action must be the single early-bird link');
const cutOpen = html(rowsFor(fx.cases.cutoffOpenWithRegular), true);
if (!/Early-bird pricing ends 25 June\./.test(cutOpen)) problems.push('cutoff open: "Early-bird pricing ends 25 June." not rendered');
if (/Early-bird pricing ends/.test(html(rowsFor(fx.cases.cutoffOpenWithRegular), false))) problems.push('closed: early-bird end date renders while sales are closed');

const cardHtml = renderToStaticMarkup(createElement(TicketTypeCard as any, { ticketType: { slug: 'day-visitor', name: 'Day Visitor Ticket', price: 150, description: 'x', soldOut: false, provisional: true, requiresDaySelection: true }, mode: 'buy', soldOutLabel: 'Sold out', quantity: 0, onQuantityChange: () => {} }));
if (/<img|<picture|data-nimg|orchid-/.test(cardHtml)) problems.push('TicketTypeCard (buy) renders a photograph');
const listHtml = renderToStaticMarkup(createElement(TicketTypeCard as any, { ticketType: { slug: 'vip', name: 'VIP Ticket', price: 300, description: 'x', soldOut: false, provisional: false, requiresDaySelection: false }, mode: 'list', soldOutLabel: 'Sold out' }));
if (/<img|<picture|data-nimg|orchid-/.test(listHtml)) problems.push('TicketTypeCard (list) renders a photograph');

if (problems.length) { console.error(`FAIL (${problems.length}):\n- ${problems.join('\n- ')}`); process.exit(1); }
console.log('PASS: rows model, early-bird window edges, sales-open and sales-closed markup all match the fixtures');
