#!/usr/bin/env node
// RETIRED by launch-weekend F18 (goldens/f18/supersession.json): replaced by the v13 keepsake ticket checks; no gate runs this file.
/* eslint-disable @typescript-eslint/no-explicit-any -- fixture-driven check; component props are loosely typed on purpose */
// A4 (amended by F17 scope E: a captioned price and its own ghost action per tier, sold-out on its own action): render-level proof of lib/admission-rows.ts and components/tickets/AdmissionRows.tsx against goldens/f16/rows-fixtures.json.
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
  if (r.key !== e.key || r.name !== e.name || shape(r) !== JSON.stringify(e.tiers) || r.requiresDaySelection !== e.requiresDaySelection) problems.push(`siblingPairs: row ${i + 1} is ${JSON.stringify(r)}, want ${JSON.stringify(e)}`);
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
const esc = (x: string) => x.replace(/[()]/g, (c) => String.fromCharCode(92) + c);
const tagsOf = (h: string) => h.match(/<(?:a|span)\b[^>]*data-ticket-row-action[^>]*>/g) ?? [];
const tiersTotal = sib.reduce((n, r) => n + r.tiers.length, 0);
if (tagsOf(open).length !== tiersTotal) problems.push(`open: ${tagsOf(open).length} actions for ${tiersTotal} priced tiers, want one own action per tier`);
for (const t of tagsOf(open)) if (/[\s"]bg-primary[\s"]/.test(t) || !/border-primary/.test(t)) problems.push(`open: an action is not the ghost (outline) variant: ${t.slice(0, 120)}`);
for (const slug of ['early-bird', 'day-visitor', 'weekend-pass-early-bird', 'weekend-pass', 'vip']) if (!new RegExp(`href="/tickets/${slug}"`).test(open)) problems.push(`open: no own action to /tickets/${slug}`);
for (const r of sib) {
  const dual = r.tiers.length > 1;
  for (const t of r.tiers) {
    const cap = new RegExp(`<span data-ticket-caption="" class="([^"]*)">${esc(t.name)}</span>`).exec(open);
    if (!cap) { problems.push(`open: caption "${t.name}" missing`); continue; }
    if (dual && /sr-only/.test(cap[1])) problems.push(`open: caption "${t.name}" is hidden in a dual row`);
    if (!dual && t.name === r.name && !/sr-only/.test(cap[1])) problems.push(`open: single-tier caption equal to the row name "${t.name}" should be sr-only`);
    if (!new RegExp(`<span class="sr-only"> — ${esc(t.name)}</span>`).test(open)) problems.push(`open: the action for "${t.name}" does not carry the SKU name in its accessible name`);
  }
}
const soldFx = fx.cases.earlySoldOut;
const sold = html(rowsFor(soldFx), true);
for (const slug of soldFx.soldOutSlugs) if (new RegExp(`href="/tickets/${slug}"`).test(sold)) problems.push(`soldOut: ${slug} still links while sold out`);
if ((sold.match(/data-sold-out/g) ?? []).length !== soldFx.soldOutSlugs.length || !/aria-disabled="true"[^>]*>Sold out/.test(sold) && !/data-sold-out[^>]*>Sold out/.test(sold)) problems.push('soldOut: the sold-out SKU must show "Sold out" on its own non-link action');
for (const slug of soldFx.liveSlugs) if (!new RegExp(`href="/tickets/${slug}"`).test(sold)) problems.push(`soldOut: the live SKU ${slug} lost its action`);
const single = html(rowsFor(fx.cases.cutoffOpenWithRegular), true);
if ((single.match(/href="\/tickets\/vip"/g) ?? []).length !== fx.cases.cutoffOpenWithRegular.expectRow.singleSkuActions) problems.push('single SKU with two prices (own early-bird window): want exactly one action');
if (/<img|<svg|<picture|background-image/.test(open + closed)) problems.push('rows markup contains a photograph or graphic');
if (!/R120/.test(open) || !/R150/.test(open) || !/R360/.test(open) || !/R380/.test(open) || !/R300/.test(open)) problems.push('open: dual prices R120/R150 and R360/R380 and R300 not all rendered');
const cutOpen = html(rowsFor(fx.cases.cutoffOpenWithRegular), true);
if (!/Early-bird pricing ends 25 June\./.test(cutOpen)) problems.push('cutoff open: "Early-bird pricing ends 25 June." not rendered');
if (/Early-bird pricing ends/.test(html(rowsFor(fx.cases.cutoffOpenWithRegular), false))) problems.push('closed: early-bird end date renders while sales are closed');

const cardHtml = renderToStaticMarkup(createElement(TicketTypeCard as any, { ticketType: { slug: 'day-visitor', name: 'Day Visitor Ticket', price: 150, description: 'x', soldOut: false, provisional: true, requiresDaySelection: true }, mode: 'buy', soldOutLabel: 'Sold out', quantity: 0, onQuantityChange: () => {} }));
if (/<img|<picture|data-nimg|orchid-/.test(cardHtml)) problems.push('TicketTypeCard (buy) renders a photograph');
const listHtml = renderToStaticMarkup(createElement(TicketTypeCard as any, { ticketType: { slug: 'vip', name: 'VIP Ticket', price: 300, description: 'x', soldOut: false, provisional: false, requiresDaySelection: false }, mode: 'list', soldOutLabel: 'Sold out' }));
if (/<img|<picture|data-nimg|orchid-/.test(listHtml)) problems.push('TicketTypeCard (list) renders a photograph');

if (problems.length) { console.error(`FAIL (${problems.length}):\n- ${problems.join('\n- ')}`); process.exit(1); }
console.log('PASS: rows model, early-bird window edges, sales-open and sales-closed markup all match the fixtures');
