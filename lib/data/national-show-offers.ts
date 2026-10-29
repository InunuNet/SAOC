// =============================================================
// NOS — lib/data/national-show-offers.ts
// The schema.org Offer list the /national-show hub emits, built from the hub's own card
// pipeline. Moved out of the page so it can be exercised without importing a route file.
// =============================================================

import type { NationalShowOffer } from '@/components/seo/JsonLd';
import { buildHubCards, type HubCmsTicketType } from '@/lib/data/ticket-hub-source';
import { DAY_VISITOR_SELLABLE_DAYS } from '@/lib/provisional-figures';
import { toShowIsoDate } from '@/lib/show-identity';
import { nosUrl } from '@/lib/site-hosts';
import { buildTicketOffers } from '@/lib/ticket-offers';
import { ticketTypeMatchesActiveShow } from '@/lib/ticket-on-sale';

const TICKET_PRODUCT_BASE_URL = nosUrl('/tickets');
const OFFER_CURRENCY = 'ZAR';

export interface SanityHubTicketType extends HubCmsTicketType {
  _id: string;
  price: number;
}

/**
 * One Offer per product the tickets hub displays, derived from the hub's own card pipeline
 * (buildHubCards, then buildTicketOffers) so the rich result and the hub can never disagree:
 * siblings collapse to the one the hub shows, programme and field-trip products are included,
 * a demo product never appears, and a card the hub marks sold out reads SoldOut. Prices are the
 * ones checkout would charge now (resolveEffectivePrice, inside the card builder), so an
 * early-bird cutoff passing never leaves the rich result advertising a price the purchase flow
 * will not honour. Prices reach the served page through the existing `revalidate = 60` ISR bound
 * plus the /api/revalidate Sanity webhook, never baked in.
 *
 * Stock is Sanity-only (a released quantity of 0 reads SoldOut), deliberately NOT live Firestore
 * sold counts: this page is prerendered, and contracts/contract-build-without-secrets.yaml
 * A3/A7 forbid a prerendered page reaching firebase-admin (and require this page keep
 * `revalidate = 60`). A pool sold out in Firestore reads SoldOut on /national-show/tickets, which
 * is request-time; the per-product /tickets/<slug> page each offer URL points at renders live
 * inventory.
 */
export function buildShowOffers(
  ticketTypes: SanityHubTicketType[],
  now: Date,
  activeShowId: string | null
): NationalShowOffer[] {
  const { cards } = buildHubCards({
    cmsTypes: ticketTypes,
    salesOpen: true,
    soldByType: {},
    soldByDay: null,
    stockKnown: true,
    now,
    showDays: DAY_VISITOR_SELLABLE_DAYS,
    activeShowId,
  });
  const cutoffBySlug = new Map(
    ticketTypes
      .filter((t) => ticketTypeMatchesActiveShow(t, activeShowId))
      .map((t) => [t.slug, t.earlyBirdCutoff])
  );
  return buildTicketOffers(cards).map((offer) => ({
    name: offer.name,
    price: offer.price,
    priceCurrency: OFFER_CURRENCY,
    availability: offer.availability,
    validThrough: toShowIsoDate(cutoffBySlug.get(offer.slug)),
    url: `${TICKET_PRODUCT_BASE_URL}/${offer.slug}`,
  }));
}
