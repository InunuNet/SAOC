// F18-A28 (F18b, v13 components at render level, no CMS, no server): TicketCard, SessionTicketCard, PoolBanner and TicketFan from components/tickets/keepsake (index exports all four) rendered with
// view-model fixtures in every state of HANDOFF section 2. Strings are those of goldens/f18b/v13-copy.json only. Fixture numbers here are test inputs, never page copy.
//   every card  -> article[data-ticket-card][data-ticket-state][aria-label=name] with id ticket-<productId>, stub [data-ticket-stub] aria-hidden, price "R300" (integer rand, no decimals), name h3
//   available   -> stepper group labelled "<name> quantity", buttons "One fewer" (disabled at the minimum 1) and "One more", output aria-live polite, max = min(10, remaining); CTA text "Buy ticket"
//   low         -> tag "Few left" and the server-supplied scarcity text; soldOut/pricePending/earlyBirdSoldOut -> NO stepper and NO CTA of any kind, the state's words (stamp, "Price to follow" + chip, "Early bird sold out")
//   early bird  -> struck "Early-bird price" line on the sold-out state, "Early-bird R360, then R380" under the price on the live early-bird SKU, "Shared with the <partner>" only on early-bird SKUs
//   Day Pass    -> fieldset legend "Choose a day", one native radio per days[] entry ("Fri 24" + "58 of 1000"), disabled radios for soldOut/pricePending/earlyBirdSoldOut, no count when remaining is null, first selectable checked
//   CTA         -> "Buy ticket" on every paid product including SAOC Symposium, WOSA Conference and session cards; never "Register" or "Add to booking"; the Workshops product card says "Choose a session" and links #sessions
//   PoolBanner  -> role group, numeral + "of <total>", "Early-bird tickets left"; out state "Early bird sold out"; null pool renders nothing; data-pool-bracket present when a pool renders
//   TicketFan   -> [data-nos-ticket-fan] with 4 [data-fan-link] anchors #ticket-vip, #ticket-sunset, #ticket-weekend, #ticket-day labelled "<name>, R<price>" / ", price to follow" / ", sold out"
//   sessions    -> every WorkshopSessionViewModel null case of HANDOFF 3.7
// Run: pnpm exec tsx contracts/checks/launch-weekend/f18/check-s-cards-render.mts   (cwd = implementation worktree)
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
const vm = (o: Obj): Obj => ({ slug: 'vip', state: 'available', price: 300, regularPrice: null, scarcity: { remaining: 146, total: 200, label: 'places left' }, days: null, ...o });
const card = (productId: string, v: Obj) => R('TicketCard', { productId, vm: v });
const has = (h: string, s: string) => txt(h).includes(s);
const buttons = (h: string) => [...h.matchAll(/<button[^>]*>/g)].map((m) => m[0]);
const BANNED = [...(JSON.parse(readFileSync(`${G}/v13-tokens.json`, 'utf8')).cta.bannedOnPaid as string[])];

// available
let h = card('vip', vm({}));
if (!/<article[^>]*data-ticket-card/.test(h) || !/data-ticket-state="available"/.test(h) || !/aria-label="VIP Opening"/.test(h) || !/id="ticket-vip"/.test(h)) fail('available: article hooks, aria-label "VIP Opening" or id ticket-vip missing');
if (!/data-ticket-stub[^>]*aria-hidden="true"|aria-hidden="true"[^>]*data-ticket-stub/.test(h)) fail('available: the stub is not aria-hidden');
if (!/<h3[^>]*>\s*VIP Opening/.test(h)) fail('available: the name is not an h3');
if (!/>R<\/span>300|R300/.test(h.replace(/<[^>]+>/g, '')) && !/R300/.test(txt(h).replace(/\s/g, ''))) fail('available: price does not read R300');
if (/R300\.00|300\.00/.test(h)) fail('available: price carries decimals');
if (!has(h, S.buy)) fail(`available: CTA text "${S.buy}" missing`);
for (const b of BANNED) if (has(h, b)) fail(`available: banned CTA wording "${b}"`);
if (!/role="group"[^>]*aria-label="VIP Opening quantity"/.test(h)) fail('available: stepper group is not labelled "VIP Opening quantity"');
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
if (/data-ticket-count/.test(h)) fail('soldOut: the scarcity slot is not masked');
h = card('vip', vm({ state: 'pricePending', price: null }));
if (buttons(h).length || /data-ticket-cta/.test(h)) fail('pricePending: a button or CTA renders');
if (!has(h, S.pricePending) || !has(h, S.chip) || !has(h, S.pendingNote)) fail('pricePending: "Price to follow", chip or note missing');
if (/R\d/.test(txt(h))) fail('pricePending: a price numeral renders');
h = card('weekend', vm({ slug: 'weekend-pass-early-bird', state: 'earlyBirdSoldOut', price: 360, regularPrice: 380, scarcity: null }));
if (buttons(h).length || /data-ticket-cta/.test(h)) fail('earlyBirdSoldOut: a button or CTA renders');
if (!has(h, S.earlyBirdSoldOut) || !/<s[^>]*>\s*Early-bird price/.test(h) || !has(h, 'The Weekend Pass is now R380.')) fail('earlyBirdSoldOut: struck "Early-bird price", "Early bird sold out" or "The Weekend Pass is now R380." missing');

// early-bird SKU live, regular SKU
h = card('weekend', vm({ slug: 'weekend-pass-early-bird', price: 360, regularPrice: 380, scarcity: { remaining: 312, total: 500, label: 'early-bird left' } }));
if (!has(h, 'Early-bird R360, then R380')) fail('early-bird SKU: "Early-bird R360, then R380" missing under the price');
if (!has(h, `${S.sharedWith} Day Pass`)) fail('early-bird SKU: "Shared with the Day Pass" missing');
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
if (!has(h, S.chooseSession) || !/href="#sessions"/.test(h) || has(h, S.buy)) fail('Workshops product card: want "Choose a session" linking #sessions and no "Buy ticket"');

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
h = sess({ presenterId: 'p1', presenterName: 'Fixture Presenter' });
if (!has(h, 'With Fixture Presenter')) fail('session: "With <presenter name>" missing');

// pool banner
h = R('PoolBanner', { pool: { remaining: 312, total: 500 } });
if (!/role="group"/.test(h) || !has(h, S.poolTitle) || !has(h, '312') || !has(h, 'of 500') || !/data-pool-banner/.test(h)) fail('PoolBanner: group, title, numeral, "of 500" or hook missing');
if (!/data-pool-bracket/.test(h)) fail('PoolBanner: no [data-pool-bracket] (shown from 960px up)');
h = R('PoolBanner', { pool: { remaining: 0, total: 500 } });
if (!has(h, S.poolOutTitle) || !has(h, 'Both passes are now at their normal price.')) fail('PoolBanner out: "Early bird sold out" copy missing');
if (R('PoolBanner', { pool: null }).replace(/<!--.*?-->/g, '').trim() !== '') fail('PoolBanner: a null pool must render nothing (R7)');

// hero fan
const fanCards = { vip: vm({ price: 300 }), sunset: vm({ slug: 'sunset-cocktails-single', price: 800, state: 'soldOut' }), weekend: vm({ slug: 'weekend-pass-early-bird', price: 360, regularPrice: 380 }), day: vm({ slug: 'early-bird', price: 120, state: 'pricePending' }) };
h = R('TicketFan', { cards: fanCards });
const links = [...h.matchAll(/<a[^>]*data-fan-link[^>]*>/g)].map((m) => m[0]);
if (!/data-nos-ticket-fan/.test(h) || links.length !== 4) fail(`TicketFan: want [data-nos-ticket-fan] with 4 [data-fan-link], got ${links.length}`);
['#ticket-vip', '#ticket-sunset', '#ticket-weekend', '#ticket-day'].forEach((a, i) => { if (!links[i]?.includes(`href="${a}"`)) fail(`TicketFan: link ${i + 1} does not point to ${a}`); });
for (const l of ['VIP Opening, R300', 'Sunset Cocktails, sold out', 'Weekend Pass, R360', 'Day Pass, price to follow']) if (!h.includes(`aria-label="${l}"`)) fail(`TicketFan: aria-label "${l}" missing`);
if (/data-ticket-stepper|data-ticket-cta|<button/.test(h)) fail('TicketFan: the mini tickets carry a stepper, CTA or button (the whole ticket is one link)');

if (problems.length) { console.error(`FAIL F18-A28 (${problems.length}):\n- ${problems.join('\n- ')}`); process.exit(1); }
console.log('PASS F18-A28 keepsake ticket components (render level)');
