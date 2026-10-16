// F18-A24 (R62, R81, render level, no CMS, no server): the ticket-screen rules on the real components with fixtures. Run under two TZ values (the command sets TZ) so the weekday never depends on the machine.
//   formatShowDay        -> exported from lib/show-day-format.ts; the six cases of tokens.tickets.dayFormat.cases ("Thu 23 Sept 2027"), SA English month names (Sept), weekday computed from the calendar date in UTC, input that is not YYYY-MM-DD returned unchanged
//   DayQuantityPicker    -> each row's aria-label and visible text is the formatted day; <time datetime="ISO"> carries the ISO; no ISO text outside the datetime attribute; the stepper aria-labels read "... for Thu 23 Sept 2027"; legend "Tickets per day" has no uppercase class and no tracking-[0.16em] mono role (14px sentence-case form label)
//   TicketPurchaseForm   -> Buy ENABLED at quantity 0 (vote 2) with aria-describedby resolving to an empty [data-buy-hint] region (filled by a click, A23 proves the click); the string "Please select at least one ticket." exists in the source; one Total in aria-live polite beside the Buy button; no "estimate"; "Provisional pricing" at most once
//   TicketTypeCard (list) -> prices through formatRand: R150 and R250.50, never R150.00
// Run: TZ=Pacific/Auckland pnpm exec tsx contracts/checks/launch-weekend/f18/check-p-tickets-render.mts && TZ=America/Los_Angeles pnpm exec tsx ...   (cwd = implementation worktree)
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { DayQuantityPicker } from '../../../../components/tickets/DayQuantityPicker';
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
const picker = renderToStaticMarkup(createElement(DayQuantityPicker as never, { showDays: days, quantitiesByDay: {}, onQuantityChange: () => undefined, disabled: false }));
if (typeof fmt === 'function') {
  for (const iso of days) {
    const label = fmt(iso);
    if (!picker.includes(`aria-label="${label}"`)) fail(`DayQuantityPicker: the row for ${iso} has no aria-label="${label}"`);
    if (!new RegExp(`<time[^>]*dateTime="${iso}"|<time[^>]*datetime="${iso}"`, 'i').test(picker)) fail(`DayQuantityPicker: no <time datetime="${iso}">`);
    for (const verb of ['Decrease quantity for', 'Increase quantity for', 'Quantity for']) if (!picker.includes(`aria-label="${verb} ${label}"`)) fail(`DayQuantityPicker: aria-label "${verb} ${label}" missing`);
  }
  const visible = picker.replace(/<[^>]+>/g, ' ');
  if (new RegExp(D.isoRegex).test(visible)) fail('DayQuantityPicker: a raw ISO date is visible text');
  const stripped = picker.replace(/(dateTime|datetime|id|value|name|for)="[^"]*"/gi, '');
  if (new RegExp(D.isoRegex).test(stripped.replace(/aria-label="[^"]*"/g, (m) => m))) fail('DayQuantityPicker: an ISO date survives outside datetime/id/value attributes (aria-label or text)');
}
const legend = /<legend[^>]*>/.exec(picker)?.[0] ?? '';
if (!legend) fail('DayQuantityPicker: no <legend>');
if (!txt(picker).includes(K.label.text)) fail(`DayQuantityPicker: legend text "${K.label.text}" missing`);
if (/uppercase|tracking-\[0\.16em\]|font-mono/.test(legend)) fail('DayQuantityPicker: the legend still carries the uppercase mono role (want the 14px sentence-case form label)');
if (!/text-\[14px\]/.test(legend)) fail('DayQuantityPicker: the legend does not set text-[14px]');

const form = (types: Record<string, unknown>[]) => renderToStaticMarkup(createElement(TicketPurchaseForm as never, { ticketTypes: types, buyButtonLabel: G.buyButtonLabel, soldOutMessage: G.soldOutMessage, showDays: days }));
const single = form([{ ...G.types[1], requiresDaySelection: true }]);
const buy = /<button[^>]*type="submit"[^>]*>/.exec(single)?.[0] ?? '';
if (/disabled/.test(buy)) fail('TicketPurchaseForm: Buy is disabled at quantity 0 (vote 2: Buy stays enabled)');
const ref = /aria-describedby="([^"]+)"/.exec(buy)?.[1];
if (!ref) fail('TicketPurchaseForm: Buy has no aria-describedby tied to the hint region');
else if (!new RegExp(`id="${ref.split(' ').pop()}"`).test(single) || !/data-buy-hint/.test(single)) fail('TicketPurchaseForm: aria-describedby does not resolve to a [data-buy-hint] region in the markup');
const hintRegion = /<[a-z]+[^>]*data-buy-hint[^>]*>([\s\S]*?)<\/[a-z]+>/.exec(single)?.[1] ?? '';
if (txt(hintRegion) !== '') fail('TicketPurchaseForm: the hint region must be empty until a click at quantity 0 (it announces, it does not shout at load)');
const src = readFileSync('components/tickets/TicketPurchaseForm.tsx', 'utf8') + readFileSync('components/tickets/useTicketCart.ts', 'utf8');
if (!src.includes(K.buyHint.text)) fail(`the string "${K.buyHint.text}" is not in TicketPurchaseForm.tsx or useTicketCart.ts`);
if (/disabled=\{[^}]*(cartItemCount|itemCount)/.test(readFileSync('components/tickets/TicketPurchaseForm.tsx', 'utf8'))) fail('TicketPurchaseForm.tsx still disables Buy on the item count');
const totalAt = single.indexOf('data-catalogue-total');
if (totalAt < 0) fail('TicketPurchaseForm: no [data-catalogue-total]');
else {
  const region = single.slice(Math.max(0, totalAt - 300));
  if (!/aria-live="polite"/.test(region.slice(0, 700))) fail('TicketPurchaseForm: the total is not in an aria-live="polite" region');
  const block = txt(single.slice(totalAt));
  if (!/\bTotal\b/.test(block)) fail('TicketPurchaseForm: the total block does not say "Total"');
  if (/estimat/i.test(block)) fail('TicketPurchaseForm: the total block says "estimate"');
  if (!/type="submit"/.test(single.slice(totalAt))) fail('TicketPurchaseForm: Buy is not inside or after the total block');
  if (/R\d+\.00\b/.test(block)) fail('TicketPurchaseForm: the total shows zero cents');
}
if ((txt(single).match(new RegExp(K.provisionalNote, 'g')) ?? []).length > 1) fail(`TicketPurchaseForm: "${K.provisionalNote}" renders more than once`);
if (/Estimated total|\(estimate\)/.test(single)) fail('TicketPurchaseForm: the old "Estimated total ... (estimate)" wording renders');

const card = (price: number) => renderToStaticMarkup(createElement(TicketTypeCard as never, { ticketType: { ...G.types[0], price, soldOut: false, provisional: false, requiresDaySelection: false, regularPrice: null }, mode: 'list', soldOutLabel: 'Sold out' }));
if (!/>R150</.test(card(150).replace(/<!-- -->/g, ''))) fail('TicketTypeCard (list): price 150 does not render as "R150"');
if (/R150\.00/.test(card(150))) fail('TicketTypeCard (list): price 150 renders with zero cents');
if (!/R250\.50/.test(card(250.5))) fail('TicketTypeCard (list): price 250.50 lost its cents');

if (problems.length) { console.error(`FAIL F18-A24 (${problems.length}):\n- ${problems.join('\n- ')}`); process.exit(1); }
console.log(`PASS F18-A24 ticket screen rules (render level, TZ=${process.env.TZ ?? 'unset'})`);
