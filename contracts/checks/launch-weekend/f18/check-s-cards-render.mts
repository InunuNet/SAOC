// F18-A28 (F18b; F18_PART=c runs the F18c session part only as A33) (v13 components at render level, no CMS, no server): TicketCard, SessionTicketCard, PoolBanner and TicketFan from components/tickets/keepsake (index exports all four) rendered with
// view-model fixtures in every state of HANDOFF section 2. Strings are those of goldens/f18b/v13-copy.json only. Fixture numbers here are test inputs, never page copy.
//   every card  -> article[data-ticket-card][data-ticket-state][aria-label=name] with id ticket-<productId>, stub [data-ticket-stub] aria-hidden, price "R300" (integer rand, no decimals), name h3
//   available   -> stepper group labelled "<name> quantity", buttons "One fewer" (disabled at the minimum 1) and "One more", output aria-live polite, max = min(10, remaining); CTA text "Buy ticket"
//   low         -> tag "Few left" and the server-supplied scarcity text; soldOut/pricePending/earlyBirdSoldOut -> NO stepper and NO CTA of any kind, the state's words (stamp, "Price to follow" + chip, "Early bird sold out")
//   early bird  -> struck "Early-bird price" line on the sold-out state, "Early-bird R360, then R380" under the price on the live early-bird SKU, "Shared with the <partner>" only on early-bird SKUs
//   Day Pass    -> fieldset legend "Choose a day", one native radio per days[] entry ("Fri 24" + "58 of 1000"), disabled radios for soldOut/pricePending/earlyBirdSoldOut, no count when remaining is null, first selectable checked
//   CTA         -> "Buy ticket" on every paid product including the National Orchid Show Symposium, WOSA Conference and session cards; never "Register" or "Add to booking"; the Workshops product card says "Choose a session" and links #sessions
//   provisional -> a count whose total is provisional (scarcity/days/pool .provisional) is hidden in public (no count line, day cells show the day only, pool banner has no numeral and reads "Early-bird tickets" + the shared-pool sentence with the CMS names) and shown in beta inside [data-placeholder] with "Not yet confirmed"; state words still show
//   PoolBanner  -> role group, numeral + "of <total>", "Early-bird tickets left"; out state "Early bird sold out"; null pool renders nothing; data-pool-bracket present when a pool renders
//   TicketFan   -> [data-nos-ticket-fan] with 4 [data-fan-link] anchors #ticket-vip, #ticket-sunset, #ticket-weekend, #ticket-day labelled "<name>, R<price>" / ", price to follow" / ", sold out"
//   sessions    -> every WorkshopSessionViewModel null case of HANDOFF 3.7
//   NAMES    -> the visible product name is the CMS ticketType name passed in as props (name, partnerName, regularName, and TicketFan names); HANDOFF names never appear in code (design-cb: CMS wins).
//   HOOKS    -> data-ticket-slug on the article carries the SKU slug it renders; a soldOut card says the stamp and "This ticket has sold out." and has no CTA and no waitlist link or wording.
// Run: [F18_PART=c] pnpm exec tsx contracts/checks/launch-weekend/f18/check-s-cards-render.mts   (cwd = implementation worktree)
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import * as K from '../../../../components/tickets/keepsake';
import { readFileSync } from 'node:fs';

type Obj = Record<string, unknown>;
const G = '.agent/memory/project/specs/launch-weekend/goldens/f18b';
const copy = JSON.parse(readFileSync(`${G}/v13-copy.json`, 'utf8')) as { products: Record<string, Obj>; strings: Record<string, unknown> };
const S = copy.strings as Record<string, string>;
const problems: string[] = [];
const fail = (m: string) => problems.push(m);
const txt = (h: string) => h.replace(/<[^>]+>/g, ' ').replace(/&#x27;|&#39;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const R = (name: string, props: Obj) => {
  const C = (K as unknown as Record<string, unknown>)[name];
  if (!C) { fail(`components/tickets/keepsake does not export ${name}`); return ''; }
  return renderToStaticMarkup(createElement(C as never, props as never));
};
const PART_C = process.env.F18_PART === 'c';
const CMS: Record<string, string> = { vip: 'VIP Ticket', sunset: 'Sunset Cocktails (Single)', weekend: 'Weekend Pass', day: 'Day Visitor Ticket', symposium: 'National Orchid Show Symposium', wosa: 'WOSA Conference', workshops: 'Workshops' };
const vm = (o: Obj): Obj => ({ slug: 'vip', state: 'available', price: 300, regularPrice: null, scarcity: { remaining: 146, total: 200, label: 'places left' }, days: null, ...o });
const card = (productId: string, v: Obj, extra: Obj = {}) => R('TicketCard', { productId, vm: v, name: CMS[productId], partnerName: productId === 'weekend' ? CMS.day : productId === 'day' ? CMS.weekend : undefined, regularName: CMS.weekend, ...extra });
const has = (h: string, s: string) => txt(h).includes(s);
const buttons = (h: string) => [...h.matchAll(/<button[^>]*>/g)].map((m) => m[0]);
const BANNED = [...(JSON.parse(readFileSync(`${G}/v13-tokens.json`, 'utf8')).cta.bannedOnPaid as string[])];

let h = '';
if (!PART_C) {
// available
h = card('vip', vm({}));
if (!/<article[^>]*data-ticket-card/.test(h) || !/data-ticket-state="available"/.test(h) || !/aria-label="VIP Ticket"/.test(h) || !/id="ticket-vip"/.test(h)) fail('available: article hooks, aria-label "VIP Ticket" or id ticket-vip missing');
if (!/data-ticket-slug="vip"/.test(h)) fail('available: the article carries no data-ticket-slug="vip" (the SKU it renders)');
if (!/data-ticket-stub[^>]*aria-hidden="true"|aria-hidden="true"[^>]*data-ticket-stub/.test(h)) fail('available: the stub is not aria-hidden');
if (!/<h3[^>]*>\s*VIP Ticket/.test(h)) fail('available: the name is not an h3');
if (!/>R<\/span>300|R300/.test(h.replace(/<[^>]+>/g, '')) && !/R300/.test(txt(h).replace(/\s/g, ''))) fail('available: price does not read R300');
if (/R300\.00|300\.00/.test(h)) fail('available: price carries decimals');
if (!has(h, S.buy)) fail(`available: CTA text "${S.buy}" missing`);
for (const b of BANNED) if (has(h, b)) fail(`available: banned CTA wording "${b}"`);
if (!/role="group"[^>]*aria-label="VIP Ticket quantity"/.test(h)) fail('available: stepper group is not labelled "VIP Ticket quantity"');
if (!/aria-label="One fewer"[^>]*disabled|disabled[^>]*aria-label="One fewer"/.test(h)) fail('available: "One fewer" is not disabled at the minimum quantity 1');
if (!/aria-label="One more"/.test(h) || /aria-label="One more"[^>]*disabled/.test(h)) fail('available: "One more" missing or disabled at 1 of 146');
if (!/<output[^>]*aria-live="polite"[^>]*>\s*1\s*</.test(h)) fail('available: quantity output is not aria-live polite starting at 1');
if (!/data-max="10"/.test(h)) fail('available: stepper max is not min(10, remaining) = 10');
if (!has(h, '146 of 200 places left')) fail('available: scarcity "146 of 200 places left" not rendered from the view model');
h = card('vip', vm({ scarcity: { remaining: 3, total: 200, label: 'places left' }, state: 'low' }));
if (!/data-max="3"/.test(h)) fail('low: stepper max is not min(10, remaining) = 3');
if (!has(h, S.fewLeft)) fail(`low: tag "${S.fewLeft}" missing`);
h = card('vip', vm({ scarcity: null }));
if (/data-ticket-count/.test(h)) fail('scarcity null: the count slot still renders');
if (!/data-max="10"/.test(h)) fail('scarcity null: max is not 10');

// masked states
h = card('vip', vm({ state: 'soldOut' }));
if (buttons(h).length || /data-ticket-cta|data-ticket-stepper/.test(h)) fail('soldOut: a button, stepper or CTA renders (cards not on sale have none, not a disabled one)');
if (!has(h, S.soldOutStamp) || !has(h, S.soldOutLine)) fail('soldOut: stamp or "This ticket has sold out." missing');
if (/waitlist|wait list/i.test(h)) fail('soldOut: waitlist wording or link renders (no waitlist, design-cb)');
if (/data-ticket-count/.test(h)) fail('soldOut: the scarcity slot is not masked');
h = card('vip', vm({ state: 'pricePending', price: null }));
if (buttons(h).length || /data-ticket-cta/.test(h)) fail('pricePending: a button or CTA renders');
if (!has(h, S.pricePending) || !has(h, S.chip) || !has(h, S.pendingNote)) fail('pricePending: "Price to follow", chip or note missing');
if (/R\d/.test(txt(h))) fail('pricePending: a price numeral renders');
h = card('vip', vm({ state: 'salesClosed', price: null, scarcity: null }));
if (buttons(h).length || /data-ticket-cta|data-ticket-stepper|<input/.test(h)) fail('salesClosed: a button, stepper, input or CTA renders (same masking as pricePending)');
if (/R\s?\d/.test(txt(h))) fail('salesClosed: a price numeral renders');
if (/data-ticket-count|waitlist/i.test(h)) fail('salesClosed: a scarcity slot or waitlist wording renders');
if (!/VIP Ticket/.test(txt(h))) fail('salesClosed: the card lost its name (the v13 card still renders, masked)');
// the page-level sales-closed status line (A35 measures it live only on a closed dataset, so its render is proved here for both modes' sake): role=status, the existing strings only
{
  const line = R('SalesStatusLine', {});
  if (line) {
    if (!/data-sales-status/.test(line)) fail('SalesStatusLine: no [data-sales-status] hook');
    if (!/role="status"/.test(line)) fail('SalesStatusLine: not role="status"');
    if (!/Sales closed/.test(txt(line))) fail('SalesStatusLine: the existing "Sales closed" string is missing');
    if (!/<a\b[^>]*href="\/[^"]*"[^>]*>[^<]*Be the first to know/.test(line)) fail('SalesStatusLine: no "Be the first to know" link');
    if (/R\s?\d|<button|<input/.test(line)) fail('SalesStatusLine: a price, button or input renders');
  }
}
h = card('weekend', vm({ slug: 'weekend-pass-early-bird', state: 'earlyBirdSoldOut', price: 360, regularPrice: 380, scarcity: null }), { name: 'Weekend Pass (Early Bird)' });
if (buttons(h).length || /data-ticket-cta/.test(h)) fail('earlyBirdSoldOut: a button or CTA renders');
if (!has(h, S.earlyBirdSoldOut) || !/<s[^>]*>\s*Early-bird price/.test(h) || !has(h, 'The Weekend Pass is now R380.')) fail('earlyBirdSoldOut: struck "Early-bird price", "Early bird sold out" or "The Weekend Pass is now R380." missing');

// early-bird SKU live, regular SKU
h = card('weekend', vm({ slug: 'weekend-pass-early-bird', price: 360, regularPrice: 380, scarcity: { remaining: 312, total: 500, label: 'early-bird left' } }), { name: 'Weekend Pass (Early Bird)' });
if (!/aria-label="Weekend Pass \(Early Bird\)"/.test(h) || !/data-ticket-slug="weekend-pass-early-bird"/.test(h)) fail('early-bird SKU: the card name is not the CMS name of the SKU it renders ("Weekend Pass (Early Bird)") or data-ticket-slug is wrong');
if (!has(h, 'Early-bird R360, then R380')) fail('early-bird SKU: "Early-bird R360, then R380" missing under the price');
if (!has(h, `${S.sharedWith} Day Visitor Ticket`)) fail('early-bird SKU: "Shared with the Day Pass" missing');
if (!has(h, '312 of 500 early-bird left')) fail('early-bird SKU: the pool line is not rendered from the view model');
h = card('weekend', vm({ slug: 'weekend-pass', price: 380, regularPrice: null, scarcity: { remaining: 214, total: 300, label: 'places left' } }));
if (has(h, S.sharedWith) || has(h, 'Early-bird')) fail('regular weekend pass: "Shared with" or an early-bird line renders');

// Day Pass
const dayVm = vm({ slug: 'day-visitor', price: 150, scarcity: null, days: [{ day: '2027-09-24', state: 'low', remaining: 58, total: 1000 }, { day: '2027-09-25', state: 'soldOut', remaining: 0, total: 1000 }, { day: '2027-09-26', state: 'available', remaining: 905, total: 1000 }] });
h = card('day', dayVm);
if (!/<fieldset[\s\S]*<legend[^>]*>\s*Choose a day/.test(h)) fail('Day Pass: no fieldset with legend "Choose a day"');
const radios = [...h.matchAll(/<input[^>]*type="radio"[^>]*>/g)].map((m) => m[0]);
if (radios.length !== 3) fail(`Day Pass: want 3 native radios, got ${radios.length}`);
if (radios[1] && !/disabled/.test(radios[1])) fail('Day Pass: the soldOut day radio is not disabled');
if (radios[0] && !/checked/.test(radios[0])) fail('Day Pass: the first selectable day is not checked');
for (const t of ['Fri 24', '58 of 1000', 'Sat 25', S.soldOutStamp, 'Sun 26', '905 of 1000', S.fewLeft]) if (!has(h, t)) fail(`Day Pass: "${t}" missing from the day cells`);
if (!/data-ticket-day/.test(h)) fail('Day Pass: day cells carry no [data-ticket-day] hook');
if (!has(h, '24') || !/Friday/.test(h)) fail('Day Pass: the stub numeral/caption does not follow the chosen day (24 Friday)');
h = card('day', vm({ ...dayVm, days: [{ day: '2027-09-24', state: 'available', remaining: null, total: null }, { day: '2027-09-25', state: 'available', remaining: null, total: null }, { day: '2027-09-26', state: 'available', remaining: null, total: null }] }));
if (/\d+ of \d+/.test(txt(h))) fail('Day Pass with unknown counts renders an "N of M" count (R7)');
h = card('day', vm({ ...dayVm, slug: 'early-bird', state: 'earlyBirdSoldOut', regularPrice: 150, days: (dayVm.days as Obj[]).map((d) => ({ ...d, state: 'earlyBirdSoldOut' })) }));
if (!has(h, S.earlyBirdEnded)) fail('Day Pass early bird sold out: day cells do not say "Early bird ended"');

// CTA on every paid product
for (const id of ['symposium', 'wosa']) {
  const x = card(id, vm({ slug: id === 'wosa' ? 'wosa-conference' : 'saoc-symposium', price: 2000 }));
  if (!has(x, S.buy)) fail(`${id}: CTA "${S.buy}" missing`);
  for (const b of BANNED) if (has(x, b)) fail(`${id}: banned CTA wording "${b}"`);
  if (!/>R<\/span>2000|R2000/.test(txt(x).replace(/\s/g, ''))) fail(`${id}: price does not read R2000`);
}
h = card('workshops', vm({ slug: 'workshops', price: 100 }));
if (!has(h, S.chooseSession) || !/href="\/national-show\/workshops#sessions"/.test(h) || has(h, S.buy)) fail('Workshops product card: want "Choose a session" linking /national-show/workshops#sessions and no "Buy ticket"');

}
if (PART_C) {
// sessions
const sess = (o: Obj) => R('SessionTicketCard', { session: { id: 'w1', title: 'Fixture workshop', description: 'Fixture description.', presenterId: null, timeSlot: 'Fixture slot', ticketCard: vm({ slug: 'workshop-w1', price: 100, scarcity: { remaining: 6, total: 10, label: 'places left' } }), ...o }, presenterName: o.presenterName ?? null });
h = sess({});
if (!has(h, S.buy) || !has(h, 'Fixture slot') || !has(h, S.admitSession) || !has(h, '6 of 10 places left')) fail('session: "Buy ticket", time slot, "One place" or the count is missing');
h = sess({ timeSlot: null, description: null });
if (!has(h, S.timeTba)) fail(`session: null timeSlot does not read "${S.timeTba}"`);
if (has(h, 'Fixture description.')) fail('session: null description still renders');
h = sess({ ticketCard: null });
if (!has(h, S.sessionNotOpen) || buttons(h).length) fail('session: null ticketCard must say "Booking for this session is not open yet." with no button');
h = sess({ ticketCard: vm({ slug: 'workshop-w1', state: 'soldOut', price: 100, scarcity: { remaining: 0, total: 10, label: 'places left' } }) });
if (buttons(h).length || !has(h, S.soldOutLine)) fail('session soldOut: a button renders or the sold-out line is missing');
h = sess({ ticketCard: vm({ slug: 'workshop-w1', price: 100, scarcity: { remaining: 6, total: 10, label: 'places left', provisional: true } }) });
if (/\b6 of 10\b/.test(txt(h)) || /data-ticket-count/.test(h)) fail('session with a provisional total, public: the count renders');
h = sess({ presenterId: 'p1', presenterName: 'Fixture Presenter' });
if (!has(h, 'With Fixture Presenter')) fail('session: "With <presenter name>" missing');

}
if (!PART_C) {
// pool banner
h = R('PoolBanner', { pool: { remaining: 312, total: 500 } });
if (!/role="group"/.test(h) || !has(h, S.poolTitle) || !has(h, '312') || !has(h, 'of 500') || !/data-pool-banner/.test(h)) fail('PoolBanner: group, title, numeral, "of 500" or hook missing');
if (!/data-pool-bracket/.test(h)) fail('PoolBanner: no [data-pool-bracket] (shown from 960px up)');
h = R('PoolBanner', { pool: { remaining: 0, total: 500 } });
if (!has(h, S.poolOutTitle) || !has(h, 'Both passes are now at their normal price.')) fail('PoolBanner out: "Early bird sold out" copy missing');
if (R('PoolBanner', { pool: null }).replace(/<!--.*?-->/g, '').trim() !== '') fail('PoolBanner: a null pool must render nothing (R7)');

// provisional counts (design-cb FINAL P2-3): public hides them, beta shows them marked, state words always show
{
  const prov = vm({ scarcity: { remaining: 146, total: 200, label: 'places left', provisional: true } });
  h = card('vip', prov);
  if (/data-ticket-count/.test(h) || /146 of 200/.test(txt(h))) fail('provisional scarcity, public: the count line renders');
  if (!/data-max="10"/.test(h)) fail('provisional scarcity, public: stepper max must stay 10 (no provisional remaining leaks into it)');
  h = card('vip', prov, { showProvisional: true });
  if (!has(h, '146 of 200 places left') || !/data-placeholder/.test(h) || !has(h, S.notYetConfirmed)) fail('provisional scarcity, beta: the count must render inside [data-placeholder] with the "Not yet confirmed" marker');
  h = card('vip', vm({ state: 'low', scarcity: { remaining: 3, total: 200, label: 'places left', provisional: true } }));
  if (!has(h, S.fewLeft)) fail('provisional low, public: the state word "Few left" must still show');
  if (/\b3 of 200\b/.test(txt(h))) fail('provisional low, public: the count renders beside the state word');
  const pdv = vm({ slug: 'day-visitor', price: 150, scarcity: null, days: [{ day: '2027-09-24', state: 'low', remaining: 58, total: 1000 }, { day: '2027-09-25', state: 'soldOut', remaining: 0, total: 1000 }, { day: '2027-09-26', state: 'available', remaining: 905, total: 1000 }] });
  const provDays = (pdv.days as Obj[]).map((d) => ({ ...d, provisional: true }));
  h = card('day', { ...pdv, days: provDays });
  if (/\d+ of \d+/.test(txt(h))) fail('provisional day cells, public: an "N of M" sub-line renders (public day cells show the day only)');
  for (const t of ['Fri 24', 'Sat 25', 'Sun 26', S.soldOutStamp, S.fewLeft]) if (!has(h, t)) fail(`provisional day cells, public: "${t}" missing (the day and its state word stay)`);
  h = card('day', { ...pdv, days: provDays }, { showProvisional: true });
  if (!has(h, '58 of 1000') || !/data-placeholder/.test(h) || !has(h, S.notYetConfirmed)) fail('provisional day cells, beta: counts must render inside [data-placeholder] with "Not yet confirmed"');
  const poolNames = { weekend: 'Weekend Pass', day: 'Early-Bird Exhibition Ticket' };
  h = R('PoolBanner', { pool: { remaining: 312, total: 500, provisional: true }, names: poolNames });
  const wantText = S.poolTextProvisional.replace('{weekend}', poolNames.weekend).replace('{day}', poolNames.day);
  if (!has(h, S.poolTitleProvisional) || has(h, S.poolTitle)) fail('PoolBanner provisional, public: the heading must be "Early-bird tickets" (not "Early-bird tickets left")');
  if (!has(h, wantText)) fail(`PoolBanner provisional, public: the sentence is not "${wantText}"`);
  if (/\d/.test(txt(h))) fail('PoolBanner provisional, public: a numeral renders');
  if (!/data-pool-banner/.test(h)) fail('PoolBanner provisional, public: lost its [data-pool-banner] hook');
  h = R('PoolBanner', { pool: { remaining: 312, total: 500, provisional: true }, names: poolNames, showProvisional: true });
  if (!has(h, '312') || !has(h, 'of 500') || !/data-placeholder/.test(h) || !has(h, S.notYetConfirmed)) fail('PoolBanner provisional, beta: the numeral must render inside [data-placeholder] with "Not yet confirmed"');
}

// hero fan
const fanCards = { vip: vm({ price: 300 }), sunset: vm({ slug: 'sunset-cocktails-single', price: 800, state: 'soldOut' }), weekend: vm({ slug: 'weekend-pass-early-bird', price: 360, regularPrice: 380 }), day: vm({ slug: 'early-bird', price: 120, state: 'pricePending' }) };
h = R('TicketFan', { cards: fanCards, names: { ...CMS, weekend: 'Weekend Pass (Early Bird)', day: 'Early-Bird Exhibition Ticket' } });
const links = [...h.matchAll(/<a[^>]*data-fan-link[^>]*>/g)].map((m) => m[0]);
if (!/data-nos-ticket-fan/.test(h) || links.length !== 4) fail(`TicketFan: want [data-nos-ticket-fan] with 4 [data-fan-link], got ${links.length}`);
['#ticket-vip', '#ticket-sunset', '#ticket-weekend', '#ticket-day'].forEach((a, i) => { if (!links[i]?.includes(`href="${a}"`)) fail(`TicketFan: link ${i + 1} does not point to ${a}`); });
for (const l of ['VIP Ticket, R300', 'Sunset Cocktails (Single), sold out', 'Weekend Pass (Early Bird), R360', 'Early-Bird Exhibition Ticket, price to follow']) if (!h.includes(`aria-label="${l}"`)) fail(`TicketFan: aria-label "${l}" missing`);
if (/data-ticket-stepper|data-ticket-cta|<button/.test(h)) fail('TicketFan: the mini tickets carry a stepper, CTA or button (the whole ticket is one link)');

}
if (problems.length) { console.error(`FAIL F18-A28${PART_C ? ' (F18c part, A33)' : ''} (${problems.length}):\n- ${problems.join('\n- ')}`); process.exit(1); }
console.log('PASS F18-A28 keepsake ticket components (render level)');
