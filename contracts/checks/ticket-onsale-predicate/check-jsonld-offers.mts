// A5 -- the Event JSON-LD offers equal the hub's displayed products. Both are derived from ONE
// pure pipeline: buildHubCards() (lib/data/ticket-hub-source.ts, the hub's card builder fed from
// the catalogue) and buildTicketOffers() (lib/ticket-offers.ts, cards -> offers). Scenarios and
// expectations are in goldens/jsonld-offers.json. Red on the baseline (modules absent).
import { finish, golden } from './_golden.mts';

const failures: string[] = [];
const hub = await import('../../../lib/data/ticket-hub-source.ts').catch((e: unknown) => {
  finish('A5 jsonld offers', [`lib/data/ticket-hub-source.ts cannot be imported: ${String(e).slice(0, 160)}`]);
});
const off = await import('../../../lib/ticket-offers.ts').catch((e: unknown) => {
  finish('A5 jsonld offers', [`lib/ticket-offers.ts cannot be imported: ${String(e).slice(0, 160)}`]);
});
const { buildHubCards } = hub as { buildHubCards: (i: unknown) => { cards: Record<string, { slug: string; state: string }> } };
const { buildTicketOffers } = off as {
  buildTicketOffers: (cards: Record<string, unknown>) => { slug: string; availability: string }[];
};

const catalogue = golden('catalogue.json');
const expected = golden('jsonld-offers.json');
const HUB_CATEGORIES = ['admission', 'conference', 'workshop-field-trip'];
const cmsTypes = catalogue.ticketTypes.filter((t: { category: string }) => HUB_CATEGORIES.includes(t.category));
const now = new Date('2026-10-25T10:00:00Z');
const SHOW_DAYS = ['2027-09-23', '2027-09-24', '2027-09-25', '2027-09-26'];

function run(soldByType: Record<string, number>, salesOpen: boolean) {
  const built = buildHubCards({ cmsTypes, activeShowId: 'show-19-2027', salesOpen, soldByType, soldByDay: null, stockKnown: true, now, showDays: SHOW_DAYS });
  return { built, offers: buildTicketOffers(built.cards) };
}

for (const sc of expected.scenarios) {
  const { built, offers } = run(sc.soldByType, true);
  const got = Object.fromEntries(offers.map((o) => [o.slug, o.availability]));
  const want = sc.offers as Record<string, string>;
  if (JSON.stringify(Object.entries(got).sort()) !== JSON.stringify(Object.entries(want).sort())) {
    failures.push(`${sc.name}: expected offers ${JSON.stringify(want)}, got ${JSON.stringify(got)}`);
  }
  // Parity with the hub: every displayed hub card backed by a real ticket type has exactly one offer.
  const hubSlugs = Object.values(built.cards).map((c) => c.slug).filter((s) => s !== 'workshops').sort();
  const offerSlugs = offers.map((o) => o.slug).sort();
  if (JSON.stringify(hubSlugs) !== JSON.stringify(offerSlugs)) failures.push(`${sc.name}: hub shows ${hubSlugs.join(',')} but offers cover ${offerSlugs.join(',')}`);
  for (const slug of expected.neverOffered) if (offerSlugs.includes(slug)) failures.push(`${sc.name}: demo product ${slug} was offered`);
  if (new Set(offerSlugs).size !== offerSlugs.length) failures.push(`${sc.name}: duplicate offers`);
}
{
  const { offers } = run({}, false);
  if (offers.length !== 0) failures.push(`sales closed: expected no offers, got ${offers.map((o) => o.slug).join(',')}`);
}
finish(`A5 jsonld offers (${expected.scenarios.length} scenarios)`, failures);
