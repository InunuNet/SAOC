import { Suspense } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { NOS_NAV } from '@/components/nos-chrome/nos-nav';
import { ShowCountdown } from '@/components/show';
import { Button } from '@/components/nos/Button';
import { NosHero } from '@/components/nos/NosHero';
import { NosSection } from '@/components/nos/NosSection';
import { JsonLd, nationalShowEventJsonLd, type NationalShowOffer } from '@/components/seo/JsonLd';
import { sanityFetch } from '@/sanity/lib/fetch';
import {
  activeShowWindowQuery,
  activeTicketTypesByCategoryQuery,
  nationalShowQuery,
  nationalShowSalesQuery,
  showVisitorInfoQuery,
} from '@/sanity/queries';
import { buildShowFacts } from '@/lib/data/show-facts';
import { cheapestAdmission, formatRand } from '@/components/nos/cheapest-admission';
import { buildHubCards, TICKET_CATEGORIES, type HubCmsTicketType } from '@/lib/data/ticket-hub-source';
import { resolveActiveShow, type ShowActivationFields } from '@/lib/show-resolution';
import { buildTicketOffers } from '@/lib/ticket-offers';
import { DAY_VISITOR_SELLABLE_DAYS } from '@/lib/provisional-figures';
import { buildPageMetadata } from '@/lib/seo';
import { nosPath } from '@/lib/nos-paths';
import { SHOW_TITLE, SHOW_TITLE_EXPANDED } from '@/lib/show-title';
import { NOS_TITLE_DEFAULT } from '@/lib/site-metadata';
import { formatVenueAddress, toShowIsoDate } from '@/lib/show-identity';
import type { ShowVenue, ShowVisitorInfo } from '@/types';
import { nosUrl } from '@/lib/site-hosts';
import type { SanityImageSource } from '@sanity/image-url';
import { nosOgImage } from '@/app/(nos)/national-show/og-image';

// F1 cms-loop: bound CDN staleness to 60s (no programmatic purge API exists for
// Firebase App Hosting — see docs/f1-cdn-purge-api-findings.md) so a Sanity publish
// propagates within F6's 120s round-trip window. See contracts/cms-loop-f1-cdn-purge.yaml.
export const revalidate = 60;

/** The hub's `<h1>` (R68, Brad): the show's plain name. nav-config keeps its own longer label
 *  as the mega-menu lead, so the two are deliberately separate. */
const HUB_HEADING = SHOW_TITLE;

const HUB_MEGA = NOS_NAV.find((n) => n.type === 'mega');

/** The mega's own Tickets leaf (the removed header CTA used to resolve it the same way). Throws at
 *  load if the leaf is ever removed rather than rendering a hero CTA with no destination. */
const TICKETS_CTA = (() => {
  const leaf = HUB_MEGA?.lead?.theShow.links.find((l) => l.id === 'tickets');
  if (!leaf)
    throw new Error('national-show hub: mega Tickets leaf missing; hero CTA cannot resolve');
  return leaf;
})();

/** The hub's two actions, label and href as nav-config carries them: the header's Tickets leaf
 *  (primary, gold) and Plan Your Visit (secondary, ghost). Used by the hero and the closing band. */
const HUB_PLAN_LINK = {
  label:
    HUB_MEGA?.columns.flatMap((c) => c.links).find((l) => l.id === 'plan-your-visit')?.label ??
    'Plan your visit',
  href:
    HUB_MEGA?.columns.flatMap((c) => c.links).find((l) => l.id === 'plan-your-visit')?.href ??
    '/national-show/plan-your-visit',
};

// ---------------------------------------------------------------------------------------
// F18 wiring (nos-design-system, M6) — the site's ONE schema.org Event node lives on this
// page and nowhere else. Every value below is derived from the Sanity nationalShow
// singleton and the admission ticketType documents; nothing here is a literal show fact.
// When Sanity lacks a name, a start date or a complete venue, nationalShowEventJsonLd()
// returns null and NO node is emitted — a placeholder date or venue is never substituted.
// ---------------------------------------------------------------------------------------

const EVENT_URL = nosUrl('/');
const TICKET_PRODUCT_BASE_URL = nosUrl('/tickets');
const OFFER_CURRENCY = 'ZAR';

interface SanityHubTicketType extends HubCmsTicketType {
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
function buildShowOffers(
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
  const cutoffBySlug = new Map(ticketTypes.map((t) => [t.slug, t.earlyBirdCutoff]));
  return buildTicketOffers(cards).map((offer) => ({
    name: offer.name,
    price: offer.price,
    priceCurrency: OFFER_CURRENCY,
    availability: offer.availability,
    validThrough: toShowIsoDate(cutoffBySlug.get(offer.slug)),
    url: `${TICKET_PRODUCT_BASE_URL}/${offer.slug}`,
  }));
}

interface SanityNationalShow {
  title: string | null;
  showDate: string | null;
  showEndDate: string | null;
  edition: number | null;
  hostRegion: string | null;
  location: string | null;
  venue: ShowVenue | null;
  hero: SanityImageSource | null;
  countdownDate: string | null;
}

const LEDE = "The National Orchid Show – Western Cape 2027 promises an immersive experience celebrating the beauty, science and future of orchids.";
const ABOUT_LEAD = "The National Orchid Show - Western Cape 2027 is the South African Orchid Council's premier triennial event, bringing together orchid enthusiasts, growers, researchers, conservationists, judges, horticultural professionals and members of the public to celebrate one of the world's most remarkable plant families.";
const ABOUT_BODY = "The National Orchid Show will showcase a spectacular display of all the orchids that are submitted for judging and display. There will be specialist plant sales by local and international vendors, educational exhibits, a comprehensive symposium and conference, practical workshops and opportunities to engage with local and international experts.";
const DATES_LABEL = "Show dates – for public entrance";
const DATES_LINE = "Thursday 23 to Sunday 26 September 2027";
const HOURS = [["Thursday VIP Ticket Holders", "14.00 to 19.00"], ["Friday & Saturday", "9.00 to 17.00"], ["Sunday", "9.00 to 16.00"]] as const;
const SYMPOSIUM_LINE = "The National Show Symposium will feature an outstanding programme of presentations by respected local and international speakers covering orchid cultivation, breeding, conservation, taxonomy, judging, sustainability and emerging scientific research.";
const WOSA_LINE = "A Conference held by Wild Orchids Southern Africa (WOSA) will highlight the ecology and conservation of indigenous orchids, illustrating how research undertaken in natural habitats continues to influence cultivation practices, breeding programmes and the long-term future of orchids.";
const WORKSHOPS_LINE = "Workshops are planned as part of the wider event programme.";
const EXHIBIT_LEAD = "All South African Orchid Council members who’s subscriptions are valid may enter orchids for judging. If you are unsure, please check with your society.";
const EXHIBIT_BODY = "All submitted orchids will be placed in the Show display. Regional Societies may also have their own displays by booking a stand. They will also be able to sell society plants on behalf of their members.";
const CLOSING = "Whether your passion lies in conservation, scientific discovery, judging, growing or simply enjoying the extraordinary beauty of orchids, the National Orchid Show – Western Cape 2027 offers an unforgettable experience that celebrates the complete journey of orchids and the people dedicated to their future.";

// HM-G1 (NOS Design, comms.md): the home keeps its approved rhythm and takes Lee-Ann's words. Every
// sentence below is verbatim from About v1.2, What to Expect v1.0 or FAQ v1.0 (docs/rules/no-invention.md):
// her About keeps its hyphen ("Show - Western Cape"), What to Expect its en dash. The section h2s Visit,
// Programme and Exhibit & trade are the nav group names; register and link labels are read from the nav.
// "who\u2019s" in FAQ 26 is her spelling (owner item vvvv).
const FACT_LABELS = ['Dates', 'Venue'] as const;
const ABOUT_HEADING = '2027 South African National Orchid Show';
const ABOUT_LINK_LABEL = 'About the show';
const WTE_LINK_LABEL = 'What to expect';
const VISIT_IDS = ['about-the-show', 'what-to-expect', 'plan-your-visit', 'faq', 'tickets'] as const;
const EXHIBIT_IDS = ['exhibitors', 'vendors', 'international-guests'] as const;
const PROGRAMME_ROWS = [
  { id: 'symposium', line: SYMPOSIUM_LINE },
  { id: 'wosa-conference', line: WOSA_LINE },
  { id: 'workshops', line: WORKSHOPS_LINE },
] as const;

// The hub keeps the full NOS default title; the group template would only repeat the show's name.
export const metadata: Metadata = {
  ...buildPageMetadata({
    title: SHOW_TITLE_EXPANDED,
    image: nosOgImage(SHOW_TITLE),
    description: LEDE,
    path: '/national-show',
  }),
  title: { absolute: NOS_TITLE_DEFAULT },
};

interface NavLeafRef {
  id: string;
  label: string;
  href: string;
}

function collectLeaves(node: unknown, into: Map<string, NavLeafRef>): void {
  if (!node || typeof node !== 'object') return;
  // Narrowing an arbitrary nav node to a string-keyed record; the typeof checks below guard every read.
  const record = node as Record<string, unknown>;
  if (
    typeof record.id === 'string' &&
    typeof record.label === 'string' &&
    typeof record.href === 'string' &&
    !into.has(record.id)
  ) {
    into.set(record.id, { id: record.id, label: record.label, href: record.href });
  }
  for (const value of Object.values(record)) collectLeaves(value, into);
}

const LEAVES = (() => {
  const leaves = new Map<string, NavLeafRef>();
  collectLeaves(NOS_NAV, leaves);
  return leaves;
})();

function leafFor(id: string): NavLeafRef {
  const leaf = LEAVES.get(id);
  if (!leaf) throw new Error(`national-show hub: the show nav has no leaf "${id}"`);
  return leaf;
}

export default async function NationalShowPage() {
  const [sanityShow, visitorInfo, salesState, shows, hubTicketTypesByCategory] = await Promise.all([
    sanityFetch<SanityNationalShow>({
      query: nationalShowQuery,
      tags: ['nationalShow', 'sanity'],
    }),
    sanityFetch<ShowVisitorInfo>({
      query: showVisitorInfoQuery,
      tags: ['showVisitorInfo', 'sanity'],
    }),
    sanityFetch<{ salesOpen?: boolean | null }>({
      query: nationalShowSalesQuery,
      tags: ['nationalShow', 'sanity'],
    }),
    sanityFetch<ShowActivationFields[]>({
      query: activeShowWindowQuery,
      tags: ['show', 'sanity'],
    }),
    Promise.all(
      TICKET_CATEGORIES.map((category) =>
        sanityFetch<SanityHubTicketType[]>({
          query: activeTicketTypesByCategoryQuery,
          params: { category },
          tags: ['ticketType', 'sanity'],
        })
      )
    ),
  ]);
  const admissionTicketTypes = hubTicketTypesByCategory[0];
  const hubTicketTypes = hubTicketTypesByCategory.flatMap((rows) => rows ?? []);

  const edition = sanityShow?.edition ?? null;
  // Dates and Venue only (HM-G1): the other shared facts are not on the home.
  const heroMeta = buildShowFacts(sanityShow).filter(({ label }) =>
    (FACT_LABELS as readonly string[]).includes(label)
  );

  // The price anchor shows only while sales are open and the cheapest admission has a price.
  const anchor =
    salesState?.salesOpen === true
      ? cheapestAdmission(admissionTicketTypes ?? [], new Date())
      : null;
  const priceAnchor =
    anchor && anchor.price > 0 ? `${anchor.type.name} from ${formatRand(anchor.price)}` : null;

  // The one Event node on the site. Offers are omitted entirely while sales are closed.
  const eventData = nationalShowEventJsonLd({
    name: SHOW_TITLE_EXPANDED,
    startDate: toShowIsoDate(sanityShow?.showDate),
    endDate: toShowIsoDate(sanityShow?.showEndDate),
    description: LEDE,
    venueName: sanityShow?.venue?.name,
    venueAddress: formatVenueAddress(sanityShow?.venue),
    url: EVENT_URL,
    offers: salesState?.salesOpen === true ? buildShowOffers(hubTicketTypes, new Date(), resolveActiveShow(shows ?? [])) : [],
  });

  const aboutLink = leafFor('about-the-show');
  const wteLink = leafFor('what-to-expect');

  return (
    <>
      {eventData ? <JsonLd data={eventData} /> : null}

      <NosHero
        route="/national-show"
        priority
        title={HUB_HEADING}
        titleSize="display"
        lede={<span data-hm-lede="">{LEDE}</span>}
        actions={
          <>
            <div className="nos-hero-row" data-hm-exempt="">
              <div className="nos-hero-cta-group">
                <div className="nos-hero-actions">
                  <Button<typeof Link>
                    as={Link}
                    href={nosPath(TICKETS_CTA.href)}
                    variant="on-dark"
                    data-nos-hero-button=""
                  >
                    <span data-nos-hero-text="btn-primary-label">{TICKETS_CTA.label}</span>
                  </Button>
                  <Button<typeof Link>
                    as={Link}
                    href={nosPath(HUB_PLAN_LINK.href)}
                    variant="ghost-on-dark"
                    data-nos-hero-button=""
                  >
                    <span data-nos-hero-text="btn-plan-label">{HUB_PLAN_LINK.label}</span>
                  </Button>
                </div>

                {priceAnchor ? (
                  <p data-nos-hero-text="price" className="nos-hero-price">
                    {priceAnchor}
                  </p>
                ) : null}
              </div>

              <Suspense fallback={null}>
                <ShowCountdown
                  label="Opens in"
                  countdownDate={sanityShow?.countdownDate}
                  edition={edition}
                  pendingLabel={visitorInfo?.pendingLabel}
                />
              </Suspense>
            </div>

            <dl className="nos-hero-facts">
              {heroMeta.map(({ label, value }, index) => (
                <div key={label}>
                  <dt data-nos-hero-text={`meta-dt-${index}`}>{label}</dt>
                  <dd data-nos-hero-text={`meta-dd-${index}`}>{value}</dd>
                </div>
              ))}
            </dl>
          </>
        }
      />

      <NosSection data-hm-section="about" aria-labelledby="hm-about-h" wrapClassName="nos-about">
        <div>
          <h2 id="hm-about-h" className="nos-hm-h2">
            {ABOUT_HEADING}
          </h2>
          <p className="nos-hm-lead">{ABOUT_LEAD}</p>
          <p className="nos-hm-body">{ABOUT_BODY}</p>
          <Link href={nosPath(aboutLink.href)} className="nos-hm-link">
            {ABOUT_LINK_LABEL} <span aria-hidden="true">&rarr;</span>
          </Link>
        </div>
        <div data-hm-visit-card="" className="ds-card nos-hm-card">
          <p className="nos-hm-card-label">{DATES_LABEL}</p>
          <p className="nos-hm-card-dates">{DATES_LINE}</p>
          <dl>
            {HOURS.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          <Link href={nosPath(wteLink.href)} className="nos-hm-link">
            {WTE_LINK_LABEL} <span aria-hidden="true">&rarr;</span>
          </Link>
        </div>
      </NosSection>

      <NosSection tone="gold" data-hm-section="visit" aria-labelledby="hm-visit-h">
        <h2 id="hm-visit-h" className="nos-hm-h2">
          Visit
        </h2>
        <ul className="nos-hm-register nos-hm-visit">
          {VISIT_IDS.map((id) => {
            const leaf = leafFor(id);
            return (
              <li key={id}>
                <Link href={nosPath(leaf.href)}>
                  <h3>{leaf.label}</h3>
                  <span aria-hidden="true">&rarr;</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </NosSection>

      <NosSection data-hm-section="programme" aria-labelledby="hm-programme-h">
        <h2 id="hm-programme-h" className="nos-hm-h2">
          Programme
        </h2>
        <ul className="nos-hm-rows">
          {PROGRAMME_ROWS.map(({ id, line }) => {
            const leaf = leafFor(id);
            return (
              <li key={id}>
                <Link href={nosPath(leaf.href)}>
                  <h3>{leaf.label}</h3>
                  <p>{line}</p>
                  <span aria-hidden="true">&rarr;</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </NosSection>

      <NosSection
        tone="gold"
        data-hm-section="exhibit"
        aria-labelledby="hm-exhibit-h"
        wrapClassName="nos-about"
      >
        <div>
          <h2 id="hm-exhibit-h" className="nos-hm-h2">
            Exhibit &amp; trade
          </h2>
          <p className="nos-hm-lead">{EXHIBIT_LEAD}</p>
          <p className="nos-hm-body">{EXHIBIT_BODY}</p>
        </div>
        <ul className="nos-hm-register">
          {EXHIBIT_IDS.map((id) => {
            const leaf = leafFor(id);
            return (
              <li key={id}>
                <Link href={nosPath(leaf.href)}>
                  {leaf.label} <span aria-hidden="true">&rarr;</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </NosSection>

      <NosSection tone="royal" data-hm-section="closing" wrapClassName="nos-hm-closing">
        <p className="nos-hm-closing-text">{CLOSING}</p>
        <div className="flex flex-wrap justify-center gap-4">
          <Button<typeof Link> as={Link} href={nosPath(TICKETS_CTA.href)} variant="on-dark">
            {TICKETS_CTA.label}
          </Button>
          <Button<typeof Link> as={Link} href={nosPath(HUB_PLAN_LINK.href)} variant="ghost-on-dark">
            {HUB_PLAN_LINK.label}
          </Button>
        </div>
      </NosSection>
    </>
  );
}
