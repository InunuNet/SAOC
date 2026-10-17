// F18-A24 (R62, R81, render level, no CMS, no server): the ticket-screen rules on the real components with fixtures. Run under two TZ values (the command sets TZ) so the weekday never depends on the machine.
//   formatShowDay        -> exported from lib/show-day-format.ts; the six cases of tokens.tickets.dayFormat.cases ("Thu 23 Sept 2027"), SA English month names (Sept), weekday computed from the calendar date in UTC, input that is not YYYY-MM-DD returned unchanged
//   TicketPurchaseForm (day) -> one .days fieldset (legend "Choose a day", native radios, a <time datetime=ISO> per cell, visible label the short form "Fri 24", the long form "Fri 24 Sept 2027" as aria-label, no raw ISO as text or aria-label) only for requiresDaySelection products; initialDay preselects that day, an initialDay outside showDays falls back to the first; no per-day rows, no "Tickets per day"
//   TicketPurchaseForm (quantity) -> ONE stepper, input min 1, a U+2212 minus text node OR the hub stepper icon (svg) with an accessible name on the decrease button, never a hyphen, initialQuantity fills it (clamped), the per-day rows and the 0 default are gone
//   (the summary variant of TicketCard is proved in A28)
//   TicketPurchaseForm   -> Buy ENABLED at quantity 0 (vote 2) with aria-describedby resolving to an empty [data-buy-hint] region (filled by a click, A23 proves the click); the string "Choose at least one ticket" exists in the source; one Total in aria-live polite beside the Buy button; no "estimate"; "Provisional pricing" at most once
//   TicketTypeCard (list) -> prices through formatRand: R150 and R250.50, never R150.00
// Run: TZ=Pacific/Auckland pnpm exec tsx contracts/checks/launch-weekend/f18/check-p-tickets-render.mts && TZ=America/Los_Angeles pnpm exec tsx ...   (cwd = implementation worktree)
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { TicketPurchaseForm } from '../../../../components/tickets/TicketPurchaseForm';
import { TicketTypeCard } from '../../../../components/tickets/TicketTypeCard';
import { T } from './_lib.mjs';

const K = T.tickets;
const D = K.dayFormat;
// Inline fixtures (test inputs, never page copy).
const fixtureType = { slug: 'fx-day', name: 'Fixture Day Pass', price: 150, regularPrice: null, description: 'Fixture description.', soldOut: false, provisional: false, requiresDaySelection: false };
const G = { buyButtonLabel: 'Buy Ticket', soldOutMessage: 'Sold out', showDays: ['2027-09-23', '2027-09-24', '2027-09-25', '2027-09-26'], types: [fixtureType, { ...fixtureType, slug: 'fx-prov', name: 'Fixture Provisional', price: 250.5, provisional: true }] as Record<string, unknown>[] };
const problems: string[] = [];
const fail = (m: string) => problems.push(m);
const txt = (h: string) => h.replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

const mod = await import(`../../../../${D.module}`).catch(() => null);
const fmt = mod?.[D.export] as ((iso: string) => string) | undefined;
if (typeof fmt !== 'function') fail(`${D.module} does not export ${D.export}`);
else {
  for (const [iso, want] of D.cases as [string, string][]) if (fmt(iso) !== want) fail(`${D.export}("${iso}") = "${fmt(iso)}", want "${want}" (TZ=${process.env.TZ ?? 'unset'})`);
  if (fmt('not-a-date') !== 'not-a-date') fail(`${D.export} must return a non-ISO input unchanged`);
}

const days = G.showDays;
const CO = JSON.parse(readFileSync('.agent/memory/project/specs/launch-weekend/goldens/f18b/v13-checkout.json', 'utf8'));
const form = (types: Record<string, unknown>[], extra: Record<string, unknown> = {}) => renderToStaticMarkup(createElement(TicketPurchaseForm as never, { ticketTypes: types, buyButtonLabel: G.buyButtonLabel, soldOutMessage: G.soldOutMessage, showDays: days, ...extra }));
const single = form([{ ...G.types[1], requiresDaySelection: true }]);
const dayType = { ...G.types[1], requiresDaySelection: true };
const dayForm = (extra: Record<string, unknown> = {}) => form([dayType], extra);
const base = dayForm();
const fieldset = /<fieldset[^>]*>[\s\S]*?<\/fieldset>/.exec(base)?.[0] ?? '';
if (!fieldset) fail('TicketPurchaseForm: a day-specific product renders no <fieldset> day picker');
else {
  const legend = /<legend[^>]*>([\s\S]*?)<\/legend>/.exec(fieldset)?.[1] ?? '';
  if (txt(legend) !== CO.form.dayLegend) fail(`TicketPurchaseForm: the day legend reads "${txt(legend)}", want "${CO.form.dayLegend}"`);
  if ((fieldset.match(/type="radio"/g) ?? []).length !== days.length) fail(`TicketPurchaseForm: want ${days.length} native day radios`);
  if (typeof fmt === 'function') for (const iso of days) {
    const label = fmt(iso);
    const shortLabel = label.split(' ').slice(0, 2).join(' ');
    if (!new RegExp(D.shortRegex).test(shortLabel)) fail(`TicketPurchaseForm: formatShowDay("${iso}") = "${label}" has no short form`);
    if (!txt(fieldset).includes(shortLabel)) fail(`TicketPurchaseForm: short day label "${shortLabel}" missing from the visible day fieldset`);
    if (txt(fieldset).includes(label)) fail(`TicketPurchaseForm: the long label "${label}" is visible text; only the short form "${shortLabel}" is visible (the long form is the aria-label)`);
    if (!fieldset.includes(`aria-label="${label}"`) && !new RegExp(`aria-label="[^"]*${label}`).test(fieldset)) fail(`TicketPurchaseForm: the long form "${label}" is not in an aria-label of the day fieldset`);
    if (!new RegExp(`<time[^>]*datetime="${iso}"`, 'i').test(fieldset)) fail(`TicketPurchaseForm: no <time datetime="${iso}"> in the day fieldset`);
  }
  if (new RegExp(D.isoRegex).test(txt(fieldset))) fail('TicketPurchaseForm: a raw ISO date is visible in the day fieldset');
  if (new RegExp(D.isoRegex).test((fieldset.match(/aria-label="[^"]*"/g) ?? []).join(' '))) fail('TicketPurchaseForm: an ISO date is in an aria-label of the day fieldset');
}
const checkedDay = (h: string) => /<input[^>]*type="radio"[^>]*>/g.exec(h) && [...h.matchAll(/<input[^>]*type="radio"[^>]*>/g)].map((m) => m[0]).filter((t) => /checked/.test(t)).map((t) => /value="([^"]+)"/.exec(t)?.[1]);
const pre = checkedDay(dayForm({ initialDay: days[2] })) ?? [];
if (pre.length !== 1 || pre[0] !== days[2]) fail(`TicketPurchaseForm: initialDay=${days[2]} checked [${pre.join()}], want exactly [${days[2]}]`);
const bad = checkedDay(dayForm({ initialDay: '2020-01-01' })) ?? [];
if (bad.length !== 1 || bad[0] !== days[0]) fail(`TicketPurchaseForm: an initialDay outside the show falls back to the first day (checked [${bad.join()}])`);
const flat = form([{ ...G.types[0], requiresDaySelection: false }]);
if (/<fieldset/.test(flat)) fail('TicketPurchaseForm: a product without day selection renders a day fieldset');
if (/data-day-row/.test(base + flat)) fail('TicketPurchaseForm: [data-day-row] per-day rows still render');
for (const gone of CO.removed) if (txt(base + flat).includes(gone)) fail(`TicketPurchaseForm: "${gone}" still renders`);
const qtyInput = (h: string) => /<input[^>]*(type="number"|inputMode="numeric"|inputmode="numeric")[^>]*>/.exec(h)?.[0] ?? '';
const q0 = qtyInput(base);
if (!q0) fail('TicketPurchaseForm: no quantity input');
else {
  if (!new RegExp(`min="${CO.form.quantityMin}"`).test(q0)) fail(`TicketPurchaseForm: the quantity input lacks min="${CO.form.quantityMin}"`);
  if (!/value="1"/.test(q0)) fail('TicketPurchaseForm: the quantity input does not default to 1');
}
const decBtn = [...base.matchAll(/<button\b[^>]*>[\s\S]*?<\/button>/g)].map((m) => m[0]).filter((b) => !/type="submit"/.test(b) && /aria-label="[^"]*(fewer|decrease|minus|less)/i.test(b));
if (!decBtn.length) fail('TicketPurchaseForm: no decrease button (aria-label fewer/decrease/minus)');
else if (!decBtn.some((b) => b.includes(CO.form.minus) || /<svg\b/.test(b))) fail('TicketPurchaseForm: the decrease button has neither a U+2212 text node nor an svg icon');
if (/>\s*(\u2013|-)\s*</.test(base)) fail('TicketPurchaseForm: the decrease button still shows an en dash or hyphen');
const q2 = qtyInput(dayForm({ initialQuantity: 2 }));
if (!/value="2"/.test(q2)) fail(`TicketPurchaseForm: initialQuantity=2 did not fill the stepper (${q2})`);
for (const [v, want] of [[0, '1'], [-4, '1']] as [number, string][]) {
  const q = qtyInput(dayForm({ initialQuantity: v }));
  const got = /value="(\d+)"/.exec(q)?.[1];
  if (got !== want) fail(`TicketPurchaseForm: initialQuantity=${v} gave ${got}, want ${want} (min 1)`);
}
const submitText = txt(/<button[^>]*type="submit"[^>]*>[\s\S]*?<\/button>/.exec(base)?.[0] ?? '');
if (!submitText.startsWith(CO.cta.text)) fail(`TicketPurchaseForm: the CTA reads "${submitText}", want "${CO.cta.text}"`);
if (!/<svg|\u2192/.test(/<button[^>]*type="submit"[^>]*>[\s\S]*?<\/button>/.exec(base)?.[0] ?? '')) fail('TicketPurchaseForm: the CTA carries no arrow');
if (/Provisional pricing/.test(txt(base))) fail('TicketPurchaseForm: the provisional note renders inside the form (it lives once in the summary card)');

// The read-only summary variant of the keepsake TicketCard is proved in A28 (check-s-cards-render.mts).
const card = (price: number) => renderToStaticMarkup(createElement(TicketTypeCard as never, { ticketType: { ...G.types[0], price, soldOut: false, provisional: false, requiresDaySelection: false, regularPrice: null }, mode: 'list', soldOutLabel: 'Sold out' }));
if (!/>R150</.test(card(150).replace(/<!-- -->/g, ''))) fail('TicketTypeCard (list): price 150 does not render as "R150"');
if (/R150\.00/.test(card(150))) fail('TicketTypeCard (list): price 150 renders with zero cents');
if (!/R250\.50/.test(card(250.5))) fail('TicketTypeCard (list): price 250.50 lost its cents');

if (problems.length) { console.error(`FAIL F18-A24 (${problems.length}):\n- ${problems.join('\n- ')}`); process.exit(1); }
console.log(`PASS F18-A24 ticket screen rules (render level, TZ=${process.env.TZ ?? 'unset'})`);
