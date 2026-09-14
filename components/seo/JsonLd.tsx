type JsonLdProps = {
  data: Record<string, unknown>;
};

export function JsonLd({ data }: JsonLdProps) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export function organizationJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'South African Orchid Council',
    alternateName: 'SAOC',
    url: 'https://saoc.co.za',
    description:
      'The South African Orchid Council (SAOC) — coordinating orchid societies across South Africa since 1968.',
    foundingDate: '1968',
    areaServed: 'ZA',
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'general',
      url: 'https://saoc.co.za/contact',
    },
  };
}

type BreadcrumbItem = { name: string; url: string };

export function breadcrumbJsonLd(items: BreadcrumbItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

type EventJsonLdProps = {
  name: string;
  startDate: string;
  endDate?: string | null;
  location?: string | null;
  venue?: string | null;
  description?: string | null;
  organizer?: string | null;
  url: string;
};

export function eventJsonLd({
  name,
  startDate,
  endDate,
  location,
  venue,
  description,
  organizer,
  url,
}: EventJsonLdProps) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name,
    startDate,
    ...(endDate ? { endDate } : {}),
    ...(description ? { description } : {}),
    url,
    eventStatus: 'https://schema.org/EventScheduled',
    location: {
      '@type': 'Place',
      name: venue ?? location ?? 'South Africa',
      ...(location ? { address: location } : {}),
    },
    organizer: {
      '@type': 'Organization',
      name: organizer ?? 'South African Orchid Council',
      url: 'https://saoc.co.za',
    },
  };
}

// ---------------------------------------------------------------------------------------------
// F18 (nos-design-system, M6) — the ONE Event node on the entire site: the current
// National Show edition, on /national-show. See goldens/m6-conversion-seo-social.golden.md
// Part B and platform-README.md D-M6b for the full decision record, including why a
// handful of schema.org identifiers folklore associates with multi-day/series events —
// a sub-event field, a super-event field, an event-attendance-mode field, an "Event
// Completed" status, and a "previous start date" field — are all deliberately absent
// here. Google's Event documentation never mentions the first three at all, does not
// list an "Event Completed" state among its four documented status values, and the
// "previous start date" field is strictly a rescheduling field requiring the
// Rescheduled status alongside it. None of the five belong in this file, ever — see
// M6/B8a, which greps this whole directory for exactly these identifiers by name in
// the golden and platform-README (read those docs for the literal spellings).
//
// This builder is pure and takes already-resolved primitives — no Sanity or
// firebase-admin import here. The caller (a Server Component) is responsible for:
//   - resolving `offers[].price` as the LOWEST currently available price via the same
//     `resolveEffectivePrice()` (lib/checkout-reservation.ts) checkout itself uses, so
//     an early-bird cutoff passing is reflected identically everywhere;
//   - resolving `offers[].availability` from `getSoldCountsByTicketType()`
//     (lib/data/tickets.ts) against `effectiveCapacity()`;
//   - fetching via `sanityFetch()` with the `nationalShow`/`ticketType` tags (as every
//     other Sanity-driven page in this repo already does) so a Studio price change
//     reaches the served page through the existing on-demand ISR webhook
//     (`/api/revalidate`) rather than being baked in at build time.
// ---------------------------------------------------------------------------------------------

/** Google documents exactly these four `eventStatus` values. An "Event Completed"
 *  status is NOT one of them and must never appear here (research §H2, confirming §H
 *  wrong). */
export type NationalShowEventStatus =
  | 'EventScheduled'
  | 'EventCancelled'
  | 'EventPostponed'
  | 'EventRescheduled';

/** Google restricts `Offer.availability` to these three values for the event
 *  experience. */
export type NationalShowOfferAvailability = 'InStock' | 'SoldOut' | 'PreOrder';

export type NationalShowOffer = {
  /** The Sanity `ticketType` name, e.g. "Early-Bird Weekend Pass". */
  name: string;
  /** The lowest currently available price for this ticket type — see the module note
   *  above for how the caller must derive this. `0` for a free ticket type. */
  price: number;
  /** Always `'ZAR'` for this site; kept as a parameter (not hardcoded) so a malformed
   *  upstream value fails loudly rather than silently mislabelling a real price. */
  priceCurrency: string;
  availability: NationalShowOfferAvailability;
  /** ISO date. Only supplied when this ticket type carries a Sanity `earlyBirdCutoff`
   *  that makes the offer date-restricted; omitted otherwise. */
  validFrom?: string | null;
  /** Bare `YYYY-MM-DD`. F18 wiring: an early-bird cutoff is the date an offer STOPS being
   *  available, which is what this field means — `validFrom` would state the opposite and
   *  publish a date-restriction Google would read backwards. Supplied only for a ticket
   *  type carrying a Sanity `earlyBirdCutoff`; omitted otherwise. */
  validThrough?: string | null;
  /** MUST be the per-product `/tickets/<slug>` page — never `/national-show/tickets`.
   *  Google requires the offer URL's predominant purpose to be selling that specific
   *  ticket to the general public, which the five-product router does not satisfy. */
  url: string;
};

export type NationalShowEventInput = {
  name?: string | null;
  /** Bare `YYYY-MM-DD` — never a midnight timestamp, which Google flags as a mistake. */
  startDate?: string | null;
  /** Bare `YYYY-MM-DD` spanning the full show. */
  endDate?: string | null;
  description?: string | null;
  venueName?: string | null;
  venueAddress?: string | null;
  organizer?: string | null;
  /** The canonical `/national-show` URL for the current edition. */
  url: string;
  eventStatus?: NationalShowEventStatus;
  offers?: NationalShowOffer[];
};

/**
 * Returns `null` — never a fabricated node — when `name`, `startDate`, or either half
 * of `location` (`venueName`/`venueAddress`) is missing. Google requires all three of
 * `name`/`startDate`/`location`; substituting a placeholder date or venue would be both
 * an SEO defect and a breach of this mission's hardest rule (no invented content).
 * Asserted structurally by M6/B9 and behaviourally by M6/B11 case 6.
 */
export function nationalShowEventJsonLd(
  input: NationalShowEventInput
): Record<string, unknown> | null {
  if (!input.name || !input.startDate || !input.venueName || !input.venueAddress) {
    return null;
  }

  return {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: input.name,
    startDate: input.startDate,
    ...(input.endDate ? { endDate: input.endDate } : {}),
    ...(input.description ? { description: input.description } : {}),
    eventStatus: `https://schema.org/${input.eventStatus ?? 'EventScheduled'}`,
    location: {
      '@type': 'Place',
      name: input.venueName,
      address: input.venueAddress,
    },
    organizer: {
      '@type': 'Organization',
      name: input.organizer ?? 'South African Orchid Council',
      url: 'https://saoc.co.za',
    },
    url: input.url,
    ...(input.offers && input.offers.length > 0
      ? {
          offers: input.offers.map((offer) => ({
            '@type': 'Offer',
            name: offer.name,
            price: offer.price,
            priceCurrency: offer.priceCurrency,
            availability: `https://schema.org/${offer.availability}`,
            ...(offer.validFrom ? { validFrom: offer.validFrom } : {}),
            ...(offer.validThrough ? { validThrough: offer.validThrough } : {}),
            url: offer.url,
          })),
        }
      : {}),
  };
}
