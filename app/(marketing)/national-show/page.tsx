import { Suspense } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { ConfirmationBadge, ShowCountdown, ShowSectionNav } from '@/components/show';
import { Button } from '@/components/nos/Button';
import { CtaBand } from '@/components/nos/CtaBand';
import { CycleStep } from '@/components/nos/CycleStep';
import { EmblemBadge } from '@/components/nos/EmblemBadge';
import { ExhibitorStageCard } from '@/components/nos/ExhibitorStageCard';
import { JudgingGroupCard } from '@/components/nos/JudgingGroupCard';
import { COLUMN_CLASS, SPAN_CLASS, resolveGridLayout } from '@/lib/grid-columns';
import { NosHero, NOS_HERO_IMAGES, type NosHeroImage } from '@/components/nos/NosHero';
import { NosHubGroup, type NosHubGroupMember } from '@/components/show/nos/NosHubGroup';
import { PastEditionCard } from '@/components/nos/PastEditionCard';
import { SectionHeading } from '@/components/nos/SectionHeading';
import { VisitorLinkCard } from '@/components/nos/VisitorLinkCard';
import { JsonLd, nationalShowEventJsonLd, type NationalShowOffer } from '@/components/seo/JsonLd';
import { sanityFetch } from '@/sanity/lib/fetch';
import {
  activeTicketTypesByCategoryQuery,
  showClassesQuery,
  pastShowsQuery,
  nationalShowQuery,
  nationalShowSalesQuery,
  showVisitorInfoQuery,
} from '@/sanity/queries';
import { showClasses as staticClasses } from '@/lib/data/showClasses';
import { shows as staticShows } from '@/lib/data/shows';
import { effectiveCapacity, resolveEffectivePrice } from '@/lib/checkout-reservation';
import { buildPageMetadata } from '@/lib/seo';
import {
  formatShowDateRange,
  formatShowMonthYear,
  formatVenueAddress,
  showYearOf,
  toOrdinal,
  toShowIsoDate,
} from '@/lib/show-identity';
import type { ShowClass, NationalShow, ShowVenue, ShowVisitorInfo } from '@/types';
import type { SanityImageSource } from '@sanity/image-url';

// F1 cms-loop: bound CDN staleness to 60s (no programmatic purge API exists for
// Firebase App Hosting — see docs/f1-cdn-purge-api-findings.md) so a Sanity publish
// propagates within F6's 120s round-trip window. See contracts/cms-loop-f1-cdn-purge.yaml.
export const revalidate = 60;

const PAGE_DESCRIPTION =
  'The South African National Orchid Show — the flagship triennial competition bringing together growers, judges and enthusiasts from all nine provinces.';

export const metadata: Metadata = buildPageMetadata({
  title: 'National Orchid Show',
  description: PAGE_DESCRIPTION,
  path: '/national-show',
});

/**
 * `object-position` for the hero photograph — the measured bloom centre of
 * `/images/orchid-violet.jpg`, not a hand-picked crop (M7 golden D2, req 2).
 *
 * How it was measured (`.tmp/sandbox/m7-dev/measure-bloom-centre.mjs`): the jpg
 * is decoded in a headless browser, drawn to a canvas at its natural 7327×4885,
 * and sampled on a 240×240 grid. A pixel counts as bloom-like under D2.1's own
 * metric — HSL saturation ≥ 0.35 and lightness ≥ 0.35 — and the constant is the
 * centroid of every bloom-like sample, expressed image-relative: 50.7% / 36.5%,
 * rounded to whole percent. 21.2% of the frame is bloom-like.
 *
 * A single declared point, not a per-breakpoint crop, so the composition holds
 * across viewport aspects. Note what it can and cannot do: `object-cover` scales
 * this 3:2 image by whichever axis is short, and at every width the hero is
 * wider than 3:2, so the horizontal axis is the one that fits exactly and the X
 * term is inert — the Y term is what lifts the bloom out from behind the type.
 */
const HERO_FOCAL_POINT = '51% 37%';

// ---------------------------------------------------------------------------------------
// F18 wiring (nos-design-system, M6) — the site's ONE schema.org Event node lives on this
// page and nowhere else. Every value below is derived from the Sanity nationalShow
// singleton and the admission ticketType documents; nothing here is a literal show fact.
// When Sanity lacks a name, a start date or a complete venue, nationalShowEventJsonLd()
// returns null and NO node is emitted — a placeholder date or venue is never substituted.
// ---------------------------------------------------------------------------------------

const EVENT_URL = 'https://saoc.co.za/national-show';
const TICKET_PRODUCT_BASE_URL = 'https://saoc.co.za/tickets';
const OFFER_CURRENCY = 'ZAR';

interface SanityAdmissionTicketType {
  _id: string;
  name: string;
  slug: string | null;
  price: number;
  regularPrice?: number | null;
  earlyBirdCutoff?: string | null;
  capacity: number;
  releasedQuantity?: number | null;
  demo?: boolean | null;
}

/**
 * One Offer per publicly listable admission ticket type, priced through the SAME
 * `resolveEffectivePrice()` checkout itself uses — so an early-bird cutoff passing can never
 * leave the rich result advertising a price the purchase flow will not honour. A type with
 * no resolvable effective price (early-bird expired, no regular price set) or no slug gets
 * NO offer rather than a guessed one. Prices reach the served page through the existing
 * `revalidate = 60` ISR bound plus the /api/revalidate Sanity webhook — never baked in.
 *
 * `availability` is derived from Sanity's released quantity alone, deliberately NOT from
 * live Firestore sold counts: this page is prerendered, and
 * contracts/contract-build-without-secrets.yaml A3/A7 forbid a prerendered page reaching
 * firebase-admin (and require this page keep `revalidate = 60`). The per-product
 * /tickets/<slug> page each offer URL points at is the surface that renders live inventory.
 */
function buildAdmissionOffers(
  ticketTypes: SanityAdmissionTicketType[],
  now: Date,
): NationalShowOffer[] {
  return ticketTypes.flatMap<NationalShowOffer>((ticketType) => {
    if (ticketType.demo || !ticketType.slug) return [];

    const price = resolveEffectivePrice({
      price: ticketType.price,
      regularPrice: ticketType.regularPrice ?? null,
      earlyBirdCutoff: ticketType.earlyBirdCutoff ?? null,
      now,
    });
    if (price === null) return [];

    const released = effectiveCapacity(ticketType.capacity, ticketType.releasedQuantity);

    return [
      {
        name: ticketType.name,
        price,
        priceCurrency: OFFER_CURRENCY,
        availability: released > 0 ? 'InStock' : 'SoldOut',
        validThrough: toShowIsoDate(ticketType.earlyBirdCutoff),
        url: `${TICKET_PRODUCT_BASE_URL}/${ticketType.slug}`,
      },
    ];
  });
}

interface SanityShowClass {
  _id: string;
  code: string;
  name: string;
  description: string;
}

interface SanityPastShow {
  _id: string;
  title: string | null;
  slug: string | null;
  year: number;
  location: string | null;
  entries: number | null;
  exhibitors: number | null;
  awards: number | null;
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

// F5 (show-visitor-info): the landing page is the section's front door. These four
// edges are what makes the visitor pages — and /national-show/archive, which returned
// 200 for months while nothing linked to it — reachable by clicking.
const VISITOR_CARDS = [
  {
    href: '/national-show/about',
    title: 'About the show',
    description: 'The 2027 theme, what the National Show brings together and who takes part.',
  },
  {
    href: '/national-show/plan-your-visit',
    title: 'Plan your visit',
    description: 'Travel from the airports, parking, public transport, where to stay and what else to see.',
  },
  {
    href: '/national-show/what-to-expect',
    title: 'What to expect',
    description: 'Opening hours, admission, food, photography, cloakroom and accessibility.',
  },
  {
    href: '/national-show/faq',
    title: 'Visitor questions',
    description: 'The questions we are asked most, answered — and honestly marked where they are not yet settled.',
  },
  {
    href: '/national-show/archive',
    title: 'Past shows',
    description: 'Previous editions, their grand champions and the galleries that went with them.',
  },
];

// F12 (M4) — the hub's four IA groups, exact ids/labels/order per
// goldens/m4/route-manifest-schema.golden.md's `groups` array and its `listed: true` rows.
// Member counts (4, 5, 4, 3) are the load-bearing case for G3b — the `programme` group
// with 5 members must derive 3 columns, not the 4 a hardcoded class would render.
const NOS_GROUPS: readonly { id: string; label: string; members: readonly NosHubGroupMember[] }[] = [
  {
    id: 'visit',
    label: 'Visit',
    members: [
      { href: '/national-show/about', label: 'About the Show' },
      { href: '/national-show/what-to-expect', label: 'What to Expect' },
      { href: '/national-show/plan-your-visit', label: 'Plan Your Visit' },
      { href: '/national-show/faq', label: 'FAQ' },
    ],
  },
  {
    id: 'programme',
    label: 'Programme',
    members: [
      { href: '/national-show/programme', label: 'Programme' },
      { href: '/national-show/workshops', label: 'Workshops' },
      { href: '/national-show/symposium', label: 'SAOC Symposium' },
      { href: '/national-show/wosa-conference', label: 'WOSA Conference' },
      { href: '/national-show/conferences', label: 'Conference Registration' },
    ],
  },
  {
    id: 'exhibit-trade',
    label: 'Exhibit & Trade',
    members: [
      { href: '/national-show/sa-exhibitors', label: 'South African Exhibitors' },
      { href: '/national-show/international-guests', label: 'International Guests' },
      { href: '/national-show/exhibitors', label: 'Exhibitor Entry Guide' },
      { href: '/national-show/vendors', label: 'Trade Vendors' },
    ],
  },
  {
    id: 'the-show',
    label: 'The Show',
    members: [
      { href: '/national-show/tickets', label: 'Tickets' },
      { href: '/national-show/sponsors', label: 'Show Sponsors' },
      { href: '/national-show/archive', label: 'Past Shows' },
    ],
  },
];

// Titles and descriptions only: these are PROCESS, which is stable, not a schedule.
// Round 1 carried four invented date ranges here that rendered live and unmarked
// whenever nationalShow.exhibitorStages was unset. Deriving them from showDate was
// rejected — staging and judging could be derived, but the stage-01/02 registration
// windows are a committee schedule no arithmetic can honestly produce.
const EXHIBITOR_STAGES = [
  {
    stage: '01',
    title: 'Register your interest',
    description:
      'Contact your provincial society to express exhibitor interest. Early registration secures bench space and priority catalogue listing.',
  },
  {
    stage: '02',
    title: 'Confirm entry and classes',
    description:
      'Submit your entry form with plant list and class selections. Entries reviewed against current SAOC judging standards.',
  },
  {
    stage: '03',
    title: 'Staging and preparation',
    description:
      'Arrive at the venue for bench set-up from early morning. All plants must be in place and labelled before the close of staging. Judging begins the following morning.',
  },
  {
    stage: '04',
    title: 'Judging and awards',
    description:
      'SAOC accredited judges assess each class over the opening days, followed by the awards ceremony. Show open to the public throughout.',
  },
];

// The past and future rows are historical/constitutional record. The CURRENT row is
// overlaid from the nationalShow singleton at render time — its host, year and edition
// are per-edition values an editor owns, not code.
const CYCLE_YEARS = [
  { year: 2024, edition: 18, host: 'KwaZulu-Natal', status: 'past' as const },
  { year: 2027, edition: 19, host: null as string | null, status: 'current' as const },
  { year: 2030, edition: 20, host: 'TBC', status: 'future' as const },
];

function toRomanOrdinal(n: number): string {
  const val = [50, 40, 10, 9, 5, 4, 1];
  const sym = ['L', 'XL', 'X', 'IX', 'V', 'IV', 'I'];
  let result = '';
  for (let i = 0; i < val.length; i++) {
    while (n >= val[i]) {
      result += sym[i];
      n -= val[i];
    }
  }
  return result;
}

// Rotates through the five rights-cleared production photographs so the past-editions
// grid does not repeat a single image across every card — none of the five is tied to a
// specific edition, so the mapping is presentational only.
function pastEditionImage(index: number): NosHeroImage {
  return NOS_HERO_IMAGES[(index + 1) % NOS_HERO_IMAGES.length];
}

export default async function NationalShowPage() {
  const [sanityClasses, sanityShows, sanityShow, visitorInfo, salesState, admissionTicketTypes] =
    await Promise.all([
      sanityFetch<SanityShowClass[]>({ query: showClassesQuery, tags: ['showClass', 'sanity'] }),
      sanityFetch<SanityPastShow[]>({ query: pastShowsQuery, tags: ['show', 'sanity'] }),
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
      sanityFetch<SanityAdmissionTicketType[]>({
        query: activeTicketTypesByCategoryQuery,
        params: { category: 'admission' },
        tags: ['ticketType', 'sanity'],
      }),
    ]);

  // Sanity wins in every fallback below. The dataset value always comes first and the
  // literal is only the right-hand side — the reverse order would mask a published
  // Studio edit behind a hardcoded default.
  // S1: one fact, two fields. The hero read the LEGACY `location` string while the CTA
  // sentence a screen below read `venue.city`, so a venue change in Studio rendered both
  // the new and the old venue in a single viewport. `venue.name` is the source; `location`
  // is fallback only. See show-identity-surfaces.golden.md.
  const venueLine = sanityShow?.venue?.name || sanityShow?.location || 'Venue to be confirmed';

  const edition = sanityShow?.edition ?? null;
  const dateRange = formatShowDateRange(sanityShow?.showDate, sanityShow?.showEndDate);
  const monthYear = formatShowMonthYear(sanityShow?.showDate);
  const hostRegion = sanityShow?.hostRegion || 'Host region to be confirmed';
  const showYear = showYearOf(sanityShow?.showDate);
  const venueCity = sanityShow?.venue?.city ?? null;
  const datesStatus = visitorInfo?.confirmations?.dates;

  const heroMeta = [
    { label: 'Dates', value: dateRange ?? 'Dates to be confirmed' },
    { label: 'Host', value: hostRegion },
    { label: 'Venue', value: venueLine },
    // Triennial is a standing constitutional fact about how the show is constituted,
    // not a per-edition value — deliberately not a Sanity field.
    { label: 'Cycle', value: 'Triennial' },
  ];

  const cycle = CYCLE_YEARS.map((entry) =>
    entry.status === 'current'
      ? {
          ...entry,
          year: showYear ?? entry.year,
          edition: edition ?? entry.edition,
          host: sanityShow?.hostRegion || 'To be confirmed',
        }
      : entry,
  );

  const ctaSentence = [
    edition ? `The ${toOrdinal(edition)} National Orchid Show` : 'The National Orchid Show',
    monthYear ? ` opens in ${monthYear}` : ' opens soon',
    venueCity ? ` in ${venueCity}.` : '.',
  ].join('');

  // The one Event node on the site. Offers are omitted entirely while sales are closed —
  // there is nothing purchasable to advertise, and an offer list is not a place to guess.
  const eventData = nationalShowEventJsonLd({
    name: sanityShow?.title,
    startDate: toShowIsoDate(sanityShow?.showDate),
    endDate: toShowIsoDate(sanityShow?.showEndDate),
    description: PAGE_DESCRIPTION,
    venueName: sanityShow?.venue?.name,
    venueAddress: formatVenueAddress(sanityShow?.venue),
    url: EVENT_URL,
    offers:
      salesState?.salesOpen === true
        ? buildAdmissionOffers(admissionTicketTypes ?? [], new Date())
        : [],
  });

  const classes: ShowClass[] =
    sanityClasses && sanityClasses.length > 0
      ? sanityClasses.map((c) => ({ id: c._id, code: c.code, name: c.name, group: '', description: c.description }))
      : staticClasses;

  // R13 (goldens/m4/grid-orphan-rule.golden.md): text-bearing cards (JudgingGroupCard
  // carries a code badge, uppercase label, serif name and description) cap at 4 columns
  // — DERIVED from the live count, never a hardcoded `lg:grid-cols-N` literal, so a
  // future change in the number of judging groups can't silently reintroduce an orphan.
  const judgingGridLayout = resolveGridLayout(classes.length);

  const pastShows: NationalShow[] =
    sanityShows && sanityShows.length > 0
      ? sanityShows.map((s) => ({
          edition: 0,
          year: s.year,
          month: 'September',
          host: s.location ?? '',
          venue: s.location ?? '',
          status: 'past',
          entries: s.entries ?? undefined,
          visitors: s.exhibitors ?? undefined,
          trophies: s.awards ?? undefined,
        }))
      : staticShows.filter((s) => s.status === 'past').slice(0, 5);

  return (
    <>
      {eventData ? <JsonLd data={eventData} /> : null}

      {/* ── Hero — practical facts and the booking path live here, above the
          narrative (Kew pattern from research item 3: a visitor's first
          question is "can I come and what does it cost"). ── */}
      <NosHero
        image="/images/orchid-violet.jpg"
        priority
        focalPoint={HERO_FOCAL_POINT}
        eyebrow="The Flagship"
        // The headline is the show's own name, set as plain text in Cormorant at
        // the scoped `--display-xl` step — NOT the Logo lockup. A lockup nested
        // inside an <h1> made the heading a composite of a decorative emblem and
        // two wordmark spans: the accessible name survived, but the type scale,
        // the measure and the line-breaking were the lockup's, not the page's,
        // and the emblem was doing masthead duty inside a heading. The mark now
        // rides above the eyebrow as `brandMark`, where it is decoration, and the
        // full lockup belongs to the masthead/colophon instead (F21).
        brandMark={<EmblemBadge />}
        title="The South African National Orchid Show"
        titleSize="display"
        lede={PAGE_DESCRIPTION}
        actions={
          <div className="flex w-full flex-col gap-8">
            {edition ? (
              // Over the photograph, pale gold holds regardless of the image
              // underneath — lilac measured 199,184,222 (weak) on the
              // bright-petal region of orchid-yellow.jpg/orchid-pink.jpg.
              <p className="font-sans text-[13px] font-medium uppercase tracking-[0.18em] text-ivory/90">
                Edition {toRomanOrdinal(edition)}
              </p>
            ) : null}

            <dl className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
              {heroMeta.map(({ label, value }) => (
                <div key={label} className="border-l-[length:var(--border-primary)] border-[var(--olive)]/50 pl-4">
                  <dt className="font-sans text-[10px] font-medium uppercase tracking-[0.2em] text-ivory/55">
                    {label}
                  </dt>
                  <dd className="mt-0.5 font-sans text-[15px] text-ivory">{value}</dd>
                </div>
              ))}
            </dl>

            {/* The dates above are our working assumption, not a committee decision.
                An unmarked plausible date range is exactly the invention this section
                must not ship — the marker is driven by showVisitorInfo.confirmations. */}
            <ConfirmationBadge
              status={datesStatus}
              pendingLabel={visitorInfo?.pendingLabel}
              researchLabel={visitorInfo?.researchLabel}
              tone="dark"
            />

            {/* Three actions, one grammar (F22). These were a filled Button plus
                two underlined inline links: three different heights, three
                different type sizes and two different hit areas for what are
                three peer destinations. Secondary is expressed by fill alone
                now — `ghost-on-dark` shares every metric with `on-dark` (same
                padding, same 15px label, same 2px radius), so the row reads as
                one control group and each target clears the same touch area. */}
            <div className="flex flex-wrap items-center gap-3">
              <Button<typeof Link> as={Link} href="/tickets" variant="on-dark">
                Book tickets →
              </Button>
              <Button<typeof Link> as={Link} href="/contact" variant="ghost-on-dark">
                Register interest
              </Button>
              <Button<typeof Link> as={Link} href="/societies" variant="ghost-on-dark">
                Find your society
              </Button>
            </div>

            <div>
              {/* Same treatment as the countdown's own unit labels ("days",
                  "hours", …) directly beneath it — font-mono 11px, uppercase,
                  0.18em, ivory/90 (components/show/ShowCountdown.tsx). This
                  label and those labels annotate one object, and a third
                  micro-caps style (font-sans 10px/500, 0.2em, ivory/70) made
                  them look like two unrelated systems stacked together (F22).
                  Adopting the denser style also raises the alpha: 10px/500 at
                  ivory/45 had measured 3.92–4.36:1 composited over the real
                  photograph, and ivory/90 clears the 4.5:1 body bar with room
                  — without darkening NosHero's scrim, which is tuned across the
                  whole hero and would regress what already passes. */}
              <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.18em] text-ivory/90">
                Opens in
              </p>
              <Suspense fallback={null}>
                <ShowCountdown
                  countdownDate={sanityShow?.countdownDate}
                  edition={edition}
                  pendingLabel={visitorInfo?.pendingLabel}
                />
              </Suspense>
            </div>
          </div>
        }
      />

      {/* ── What it is ── */}
      <section className="mx-auto grid max-w-[1280px] grid-cols-1 gap-16 px-8 py-24 lg:grid-cols-2">
        <div>
          <SectionHeading
            eyebrow="About the show"
            title={
              'Three years in the making, four days on the bench'
            }
          />
          <p className="mt-6 font-sans text-[16px] leading-relaxed text-ink/80">
            The SAOC National Orchid Show is the country&rsquo;s premier competitive orchid event.
            Held every three years, it rotates across South Africa&rsquo;s nine provinces, bringing
            together growers, hybridisers, judges and collectors for four days of competition,
            education, and community.
          </p>
          <p className="mt-4 font-sans text-[16px] leading-relaxed text-ink/80">
            Every plant is assessed by{' '}
            <Link href="/judging" className="text-[var(--accent)] underline underline-offset-2">
              accredited SAOC judges
            </Link>{' '}
            against the 100-point scale across ten botanical classes. The Grand Champion is the
            highest-scoring exhibit across all classes.
          </p>
        </div>

        {/* 4-up stats */}
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-[length:var(--radius-lg)] bg-rule">
          {[
            { value: '18', label: 'Editions held' },
            { value: '3 yr', label: 'Cycle' },
            { value: '10', label: 'Judging classes' },
            { value: '1,240', label: 'Entries — 2024' },
          ].map(({ value, label }) => (
            <div key={label} className="bg-parchment px-8 py-10">
              <div className="font-serif text-[46px] font-medium leading-none text-primary">
                {value}
              </div>
              <div className="mt-2 font-sans text-[11px] font-medium tracking-[0.16em] text-muted">
                {label}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Planning a visit — the section's front door (F5 reachability) ── */}
      <section className="mx-auto max-w-[1280px] px-8 pb-8">
        <SectionHeading eyebrow="Coming to the show" title="Planning a visit" />
        <ul className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {VISITOR_CARDS.map(({ href, title: cardTitle, description }) => (
            <li key={href}>
              <VisitorLinkCard href={href} title={cardTitle} description={description} />
            </li>
          ))}
        </ul>
      </section>

      {/* ── F12/M4 — the hub restructured into four IA groups. This is ADDED
          structure alongside the show's existing copy above (H3) — with a flat
          six-item header and no dropdown, these four groups plus
          ShowSectionNav ARE the subsection's entire primary navigation (R3/R4).
          href literals are KEPT here (not rendered from
          content/national-show-routes.json) because site-content-alignment's
          A12 greps for a literal `href: '/national-show/about'` entry in this
          file — NAV1 asserts at gate time that these literals equal the
          manifest's listed slugs exactly, in both directions. See
          goldens/m4/hub-groups.golden.md. ── */}
      <section className="mx-auto max-w-[1280px] px-8 py-16">
        <SectionHeading eyebrow="Find your way" title="Explore the National Show" />

        <div className="mt-10 space-y-14">
          {NOS_GROUPS.map(({ id, label, members }) => (
            <NosHubGroup key={id} id={id} label={label} members={members} />
          ))}
        </div>

        {/* Spec entry 14 (/societies) gets a link and no page of its own — visibly
            not one of the four groups' members, per hub-groups.golden.md §"Structural
            requirements" 3. */}
        <p className="mt-14 border-t border-rule pt-8 font-sans text-[15px] text-ink/70">
          Looking for your local orchid society?{' '}
          <Link href="/societies" className="text-[var(--accent)] underline underline-offset-2">
            Find your society
          </Link>
          .
        </p>
      </section>

      {/* ── Three-year cycle ── */}
      <section className="bg-bone py-20">
        <div className="mx-auto max-w-[1280px] px-8">
          <SectionHeading eyebrow="The rotation" title="Three-year cycle" />

          <div className="relative mt-14 grid grid-cols-1 gap-6 sm:grid-cols-3">
            {/* Connecting rail — hidden below sm, where cards stack */}
            <div className="absolute left-[calc(16.7%+1rem)] right-[calc(16.7%+1rem)] top-1 hidden h-px bg-rule sm:block" />

            {cycle.map(({ year, edition: cycleEdition, host, status }) => (
              <CycleStep
                key={year}
                year={year}
                editionLabel={`Edition ${toRomanOrdinal(cycleEdition)}`}
                host={host}
                status={status}
              />
            ))}
          </div>
          <p className="mt-6 font-sans text-[13px] text-muted">
            Host province rotates among regional orchid societies nominated by the SAOC board.
          </p>
        </div>
      </section>

      {/* ── Classes & Judging — a botanical index, not placeholder tiles ── */}
      <section className="mx-auto max-w-[1280px] px-8 py-24">
        <SectionHeading
          eyebrow="Competition structure"
          title="Ten judging groups"
          lede="Every exhibit is entered in one of ten botanical classes. Judges score on a 100-point scale covering cultural quality, presentation, and species accuracy."
        />

        <div className={`mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 ${COLUMN_CLASS[judgingGridLayout.columns]}`}>
          {classes.map((cls, index) => {
            // Only the final card in the spanning tie-break case (n = 13, 25, 37, ...)
            // gets a span class — the exact case resolveGridLayout falls back to a
            // full-width final card for, rather than leaving a lone orphan in a
            // partial row. See components/show/nos/ShowEntityGrid.tsx for the same
            // pattern applied to entity listings.
            const isFinal = index === classes.length - 1;
            const isSpanningTieBreak = judgingGridLayout.finalCardSpans > 1;
            const spanClass = isFinal && isSpanningTieBreak ? SPAN_CLASS[judgingGridLayout.finalCardSpans] : '';
            return (
              <div key={cls.id} className={spanClass}>
                <JudgingGroupCard
                  code={cls.code}
                  group={cls.group || `Group ${index + 1}`}
                  name={cls.name}
                  description={cls.description}
                />
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Exhibitor information ── */}
      {/* nos-on-dark (R9/3, R8/3): royal-purple ground — any focus ring or
          status colour inside must read the on-dark alias. See
          nos-theme.css's `.nos-theme .nos-on-dark` block. */}
      <section className="nos-on-dark bg-primary py-24">
        <div className="mx-auto max-w-[1280px] px-8">
          <SectionHeading eyebrow="Entering the show" title="Exhibitor information" tone="on-dark" />

          {/* Retiring nationalShow.exhibitorStages (exhibitor F-7): this page no longer reads
              that field. The exhibitor journey has one source — showExhibitorStep, rendered at
              /national-show/exhibitors — and what stays here is a process summary that links
              there, not a second copy an editor would have to keep in step. */}
          <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {EXHIBITOR_STAGES.map(({ stage, title: stageTitle, description }) => (
              <ExhibitorStageCard
                key={stage}
                stage={stage}
                title={stageTitle}
                description={description}
                confirmation={
                  <ConfirmationBadge
                    status={datesStatus}
                    pendingLabel={visitorInfo?.pendingLabel}
                    researchLabel={visitorInfo?.researchLabel}
                    tone="dark"
                  />
                }
              />
            ))}
          </div>

          {/* The full exhibitor guide. The stages above are a summary; without this link
              /national-show/exhibitors is reachable from the home page only — the same
              built-but-unlinked hole /national-show/archive had. */}
          <div className="mt-10">
            <Button<typeof Link> as={Link} href="/national-show/exhibitors" variant="on-dark">
              Exhibitor information →
            </Button>
          </div>
        </div>
      </section>

      {/* ── Past shows ── */}
      {pastShows.length > 0 && (
        <section className="mx-auto max-w-[1280px] px-8 py-24">
          <SectionHeading eyebrow="Show history" title="Past editions" />

          <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {pastShows.slice(0, 6).map((show, index) => (
              <PastEditionCard
                key={show.year}
                image={pastEditionImage(index)}
                editionLabel={show.edition > 0 ? `Edition ${toRomanOrdinal(show.edition)}` : String(show.year)}
                year={show.year}
                month={show.month}
                host={show.host}
                entries={show.entries}
                visitors={show.visitors}
                trophies={show.trophies}
                note={show.note}
              />
            ))}
          </div>
        </section>
      )}

      {/* ── CTA band ── */}
      <CtaBand
        title="Start planning your entry now."
        lede={`${ctaSentence} Register your interest through your society or contact the council directly.`}
        action={
          <div className="flex flex-wrap justify-center gap-4">
            <Button<typeof Link> as={Link} href="/societies" variant="on-dark">
              Find your society
            </Button>
            <Link
              href="/contact"
              className="font-sans text-[14px] font-medium text-ivory underline decoration-ivory/40 underline-offset-4 transition-colors duration-150 hover:decoration-ivory"
            >
              Ask the council
            </Link>
          </div>
        }
      />

      {/* N15 — exactly one navigation landmark inside the NOS content region, on every
          one of the 17 routes including the hub itself. R21/4 — full-bleed only at the
          foot of the page, which is why this is the very last element rendered. */}
      <ShowSectionNav current="/national-show" />
    </>
  );
}
