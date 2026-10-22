// nos-ticket-day-stub (r45) F1 server guard (saoc-82): once the hub card stops choosing a day for the buyer, the server must still refuse
// a requiresDaySelection position with no chosenDay, and nothing on the order, reservation or checkout path may supply one. QA input,
// hash-locked. The F5 idiom (contracts/checks/ticketing-f5-day-attendees/): the pure validators run, and the route's wiring is proved by
// source position, not a request-mocking harness. It passes on BASE by design: it is the guard that keeps r45's client change safe.
// Run as: pnpm exec tsx .agent/memory/project/specs/nos-ticket-day-stub/checks/f1-server.mjs (from the checkout under test).
//   V1  parseLineItems: an item with no chosenDay is kept with no chosenDay key (never filled in); chosenDay null, '' or a malformed
//       day rejects the whole cart.
//   V2  resolveChosenDayForPosition: a day-selection type with chosenDay undefined or null stays null (never invented); a real day is
//       kept; a non-day type is stripped to null.
//   V3  buildLineItemsFromCart: with no chosen days for a type its line items carry no chosenDay key (the client sends none).
//   W1  route.ts reads requiresDaySelection from the Sanity ticket type (=== true), never from the request.
//   W2  in the per-line-item loop, a requiresDaySelection item with a falsy chosenDay returns the F5 400 "A day selection is required
//       for this ticket type." before any reservation (reserveTicket) or payment initiation (paymentProvider.initiate).
//   W3  no default day anywhere on the path: route.ts, lib/checkout-reservation.ts, lib/cart.ts and components/tickets/useTicketCart.ts
//       contain no `chosenDay ?? <x>` / `chosenDay || <x>` other than `?? null`, no firstSelectableDay, and route.ts and
//       checkout-reservation.ts never index a day list ([0]) or compute show days. One `?? ''` is allowed by exact text: the
//       duplicate-request key in checkout-reservation.ts (`${item.chosenDay ?? ''}`), which names a missing day, never chooses one.
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { finish, readRepoFile, repoRoot } from './_lib.mjs';

const NAME = 'f1-server.mjs';
const ROUTE = 'app/api/tickets/checkout/route.ts';
const PATH_FILES = [ROUTE, 'lib/checkout-reservation.ts', 'lib/cart.ts', 'components/tickets/useTicketCart.ts'];
const REQUIRED_MSG = 'A day selection is required for this ticket type.';
const KEY_ONLY = { 'lib/checkout-reservation.ts': ["chosenDay ?? ''}`"] };
const failures = [];
const mod = (rel) => import(pathToFileURL(path.join(repoRoot, rel)).href);

const { parseLineItems } = await mod(ROUTE);
const { resolveChosenDayForPosition } = await mod('lib/checkout-reservation.ts');
const { buildLineItemsFromCart } = await mod('lib/cart.ts');

const item = { ticketType: 'early-bird', attendeeName: 'Test Attendee', attendeeEmail: 'attendee@example.com' };
const DAY = '2099-03-11';

// V1
const kept = parseLineItems([item]);
if (!Array.isArray(kept) || kept.length !== 1) failures.push(`parseLineItems([no chosenDay]) returned ${JSON.stringify(kept)}, want one item (V1)`);
else if (Object.prototype.hasOwnProperty.call(kept[0], 'chosenDay')) failures.push(`parseLineItems filled in chosenDay ${JSON.stringify(kept[0].chosenDay)} for an item that sent none (V1)`);
for (const bad of [null, '', 'Friday', '2099-3-11']) {
  const r = parseLineItems([{ ...item, chosenDay: bad }]);
  if (r !== null) failures.push(`parseLineItems accepted chosenDay ${JSON.stringify(bad)}: ${JSON.stringify(r)} (V1)`);
}
const withDay = parseLineItems([{ ...item, chosenDay: DAY }]);
if (!withDay || withDay[0].chosenDay !== DAY) failures.push(`parseLineItems lost a valid chosenDay: ${JSON.stringify(withDay)} (V1)`);

// V2
for (const [input, flag, want] of [[undefined, true, null], [null, true, null], [DAY, true, DAY], [DAY, false, null], [undefined, false, null]]) {
  const got = resolveChosenDayForPosition(input, flag);
  if (got !== want) failures.push(`resolveChosenDayForPosition(${JSON.stringify(input)}, ${flag}) = ${JSON.stringify(got)}, want ${JSON.stringify(want)} (V2)`);
}

// V3
const items = buildLineItemsFromCart({ 'early-bird': 2 }, { 'early-bird': [{ attendeeName: 'A', attendeeEmail: 'a@example.com' }, { attendeeName: 'B', attendeeEmail: 'b@example.com' }] }, ['early-bird'], {});
if (items.length !== 2 || items.some((i) => Object.prototype.hasOwnProperty.call(i, 'chosenDay'))) failures.push(`buildLineItemsFromCart with no chosen days gave ${JSON.stringify(items)}, want two items with no chosenDay key (V3)`);

// W1, W2
const route = readRepoFile(ROUTE) ?? '';
if (!/requiresDaySelectionByType\[slug\]\s*=\s*ticketTypeDoc\.requiresDaySelection === true;/.test(route)) failures.push(`${ROUTE}: requiresDaySelection is not read from the Sanity ticket type (W1)`);
const guard = route.search(/if \(requiresDaySelectionByType\[lineItem\.ticketType\]\) \{\s*if \(!lineItem\.chosenDay\) \{\s*return NextResponse\.json\(\s*\{ error: 'A day selection is required for this ticket type\.' \},\s*\{ status: 400 \}\s*\);/);
const loop = route.indexOf('for (const lineItem of lineItems) {');
const reserve = route.indexOf('outcome = await reserveTicket(');
const initiate = route.indexOf('await paymentProvider.initiate(');
if (guard === -1) failures.push(`${ROUTE}: no per-line-item "${REQUIRED_MSG}" 400 for a requiresDaySelection item with no chosenDay (W2)`);
else {
  if (loop === -1 || loop > guard) failures.push(`${ROUTE}: the chosenDay guard is not inside the per-line-item loop (W2)`);
  if (reserve === -1 || guard > reserve) failures.push(`${ROUTE}: the chosenDay guard does not precede reserveTicket() (W2)`);
  if (initiate === -1 || guard > initiate) failures.push(`${ROUTE}: the chosenDay guard does not precede paymentProvider.initiate() (W2)`);
}
if ((route.match(/A day selection is required for this ticket type\./g) ?? []).length !== 1) failures.push(`${ROUTE}: the "${REQUIRED_MSG}" response is not unique (W2)`);

// W3
for (const rel of PATH_FILES) {
  const src = readRepoFile(rel);
  if (src === null) { failures.push(`${rel}: missing (W3)`); continue; }
  for (const m of src.matchAll(/chosenDay\]?\)?\s*(\?\?|\|\|)\s*([^\s;,)]+)/g)) if (m[2] !== 'null' && !(KEY_ONLY[rel] ?? []).includes(m[0])) failures.push(`${rel}: defaults a chosen day with "${m[0]}" (W3)`);
  if (src.includes('firstSelectableDay')) failures.push(`${rel}: names firstSelectableDay (W3)`);
  if (rel === ROUTE || rel === 'lib/checkout-reservation.ts') {
    if (/computeShowDays\(/.test(src)) failures.push(`${rel}: computes the show days, a source a default day could come from (W3)`);
    if (/[Dd]ays\)?\[0\]/.test(src)) failures.push(`${rel}: indexes a day list at [0] (W3)`);
  }
}

finish(NAME, failures, 'the server keeps an absent chosenDay absent, rejects null/empty/malformed days, 400s a requiresDaySelection position with no chosenDay before any reservation or payment, and defaults no day anywhere on the path.');
