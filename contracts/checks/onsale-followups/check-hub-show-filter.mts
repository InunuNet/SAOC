// A2 -- the hub cards and the Event JSON-LD offers carry only ticket types whose show._ref is the
// resolved active show. Fixture replay: the recorded admission catalogue (PR #128) is fed to
// buildHubCards unchanged except that the fictional-test type's demo flag is cleared, so the
// demo filter cannot be what hides it. Pure: no network, no Sanity write.
// Usage: tsx check-hub-show-filter.mts [path-to-ticket-hub-source.ts]
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const FIXTURE =
  '.agent/memory/project/specs/nos-content-standard/fixtures/sanity/ef011a654c90e72b36f84ac6fa8936a9bbeff6f7f58305ae53256a00766b58cb.json';
const ACTIVE = 'show-19-2027';
const OTHER = 'show-fictional-test';
const FICTIONAL = 'fictional-test-show-general-admission';
const SHOW_DAYS = ['2027-09-23', '2027-09-24', '2027-09-25', '2027-09-26'];
const now = new Date('2026-10-25T10:00:00Z');

const failures: string[] = [];
const hubPath = resolve(process.argv[2] ?? 'lib/data/ticket-hub-source.ts');
const hub = await import(pathToFileURL(hubPath).href);
const off = await import(pathToFileURL(resolve('lib/ticket-offers.ts')).href);

type Doc = { slug: string; demo?: boolean | null; show?: { _ref: string } | null } & Record<string, unknown>;
const recorded = JSON.parse(readFileSync(resolve(FIXTURE), 'utf8')).result as Doc[];
if (!recorded.some((d) => d.slug === FICTIONAL) || !recorded.some((d) => d.slug === 'early-bird')) {
  failures.push('fixture no longer holds the fictional-test and early-bird types; check is vacuous');
}
// Demo flag cleared on every doc: only the show filter may now exclude the other show's type.
// A wrong-show impostor reuses a real admission slug at a distinct price: the hub keys cards by
// slug, so an unfiltered impostor would overwrite the active show's VIP card.
const IMPOSTOR_PRICE = 999;
const vip = recorded.find((d) => d.slug === 'vip');
if (!vip) failures.push('fixture holds no vip type; check is vacuous');
const impostor = { ...vip, _id: 'ticketType-vip-other-show', price: IMPOSTOR_PRICE, show: { _ref: OTHER } };
const cmsTypes = [...recorded, impostor].map((d) => ({ ...d, demo: false }));

function slugs(activeShowId: string | null): { cards: string[]; offers: string[]; vipPrice: number | null; vipOfferPrice: number | null; prices: number[] } {
  const built = hub.buildHubCards({
    cmsTypes, activeShowId, salesOpen: true, soldByType: {}, soldByDay: null, stockKnown: true, now, showDays: SHOW_DAYS,
  });
  const cards = Object.values(built.cards as Record<string, { slug: string }>).map((c) => c.slug).filter((s) => s !== 'workshops');
  const offerRows = off.buildTicketOffers(built.cards) as { slug: string; price: number }[];
  const offers = offerRows.map((o) => o.slug);
  const vipCard = (Object.values(built.cards) as { slug: string; price: number | null }[]).find((c) => c.slug === 'vip');
  const cardPrices = (Object.values(built.cards) as { price: number | null }[]).flatMap((c) => (c.price === null ? [] : [c.price]));
  const vipOffer = offerRows.find((o) => o.slug === 'vip');
  return { cards, offers, vipPrice: vipCard?.price ?? null, vipOfferPrice: vipOffer?.price ?? null, prices: [...cardPrices, ...offerRows.map((o) => o.price)] };
}

const forActive = slugs(ACTIVE);
for (const [where, list] of [['hub cards', forActive.cards], ['JSON-LD offers', forActive.offers]] as const) {
  if (list.includes(FICTIONAL)) failures.push(`${where} for ${ACTIVE} list ${FICTIONAL} (show ${OTHER}) with demo cleared`);
}
if (!forActive.cards.includes('early-bird')) failures.push(`hub cards for ${ACTIVE} lost early-bird`);
if (!forActive.offers.includes('early-bird')) failures.push(`JSON-LD offers for ${ACTIVE} lost early-bird`);

if (forActive.vipOfferPrice !== vip?.price) failures.push(`JSON-LD VIP offer for ${ACTIVE} is ${forActive.vipOfferPrice}, not the active show's ${vip?.price}`);
if (forActive.prices.includes(IMPOSTOR_PRICE)) failures.push(`a ${OTHER} price ${IMPOSTOR_PRICE} reaches hub cards or JSON-LD offers for ${ACTIVE}`);
if (forActive.vipPrice === IMPOSTOR_PRICE) failures.push(`hub VIP card for ${ACTIVE} carries the ${OTHER} impostor price ${IMPOSTOR_PRICE}`);

const forOther = slugs(OTHER);
// Under the other show only its own vip impostor may appear; the active show's other types must not.
for (const [where, list] of [['hub cards', forOther.cards], ['JSON-LD offers', forOther.offers]] as const) {
  const foreign = list.filter((s) => s !== 'vip');
  if (foreign.length) failures.push(`${where} for ${OTHER} list another show's types: ${foreign.join(',')}`);
}
if (forOther.vipOfferPrice !== IMPOSTOR_PRICE) failures.push(`JSON-LD VIP offer for ${OTHER} is ${forOther.vipOfferPrice}, not its own ${IMPOSTOR_PRICE}`);
if (forOther.vipPrice !== IMPOSTOR_PRICE) failures.push(`hub VIP card for ${OTHER} is ${forOther.vipPrice}, not its own ${IMPOSTOR_PRICE}`);

const forNone = slugs(null);
for (const [where, list] of [['hub cards', forNone.cards], ['JSON-LD offers', forNone.offers]] as const) {
  if (list.length > 0) failures.push(`${where} with no active show list CMS types: ${list.join(',')}`);
}

if (failures.length) {
  console.error(`FAIL A2 hub show filter: ${failures.length} failure(s)`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log('PASS A2 hub show filter');
