import { Suspense } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { NAV } from '@/components/chrome/nav-config';
import { ConfirmationBadge, ShowCountdown, ShowSectionNav } from '@/components/show';
import { Button } from '@/components/nos/Button';
import { CtaBand } from '@/components/nos/CtaBand';
import { ExhibitorStageCard } from '@/components/nos/ExhibitorStageCard';
import { JudgingGroupCard } from '@/components/nos/JudgingGroupCard';
import { COLUMN_CLASS, SPAN_CLASS, resolveGridLayout } from '@/lib/grid-columns';
import { NosHero } from '@/components/nos/NosHero';
import { NosHubGroup, type NosHubGroupMember } from '@/components/show/nos/NosHubGroup';
import { SectionHeading } from '@/components/nos/SectionHeading';
import { VisitorLinkCard } from '@/components/nos/VisitorLinkCard';
import { JsonLd, nationalShowEventJsonLd, type NationalShowOffer } from '@/components/seo/JsonLd';
import { sanityFetch } from '@/sanity/lib/fetch';
import {
  activeTicketTypesByCategoryQuery,
  showClassesQuery,
  nationalShowQuery,
  nationalShowSalesQuery,
  showVisitorInfoQuery,
} from '@/sanity/queries';
import { showClasses as staticClasses } from '@/lib/data/showClasses';
import { effectiveCapacity, resolveEffectivePrice } from '@/lib/checkout-reservation';
import { buildPageMetadata } from '@/lib/seo';
import {
  formatShowDateRange,
  formatShowMonthYear,
  formatVenueAddress,
  toOrdinal,
  toShowIsoDate,
} from '@/lib/show-identity';
import type { ShowClass, ShowVenue, ShowVisitorInfo } from '@/types';
import type { SanityImageSource } from '@sanity/image-url';

// F1 cms-loop: bound CDN staleness to 60s (no programmatic purge API exists for
// Firebase App Hosting — see docs/f1-cdn-purge-api-findings.md) so a Sanity publish
// propagates within F6's 120s round-trip window. See contracts/cms-loop-f1-cdn-purge.yaml.
export const revalidate = 60;

const PAGE_DESCRIPTION =
  'The South African National Orchid Show — the flagship triennial competition bringing together growers, judges and enthusiasts from all nine provinces.';

// Display-hero lede only (Brad, 2026-09-29): PAGE_DESCRIPTION repeats the
// lockup's "National Orchid Show" and the eyebrow's "flagship", so the hero
// carries this instead. Metadata and JSON-LD keep PAGE_DESCRIPTION.
const HERO_LEDE =
  'South Africa’s triennial orchid competition, bringing together growers, judges and enthusiasts from all nine provinces.';

export const metadata: Metadata = buildPageMetadata({
  title: 'National Orchid Show',
  description: PAGE_DESCRIPTION,
  path: '/national-show',
});

/** The hub's `<h1>`: the show's name as nav-config carries it, never retyped here. */
const HUB_MEGA = NAV.find((n) => n.type === 'mega');
const HUB_HEADING = HUB_MEGA?.lead?.leadLabel;

/** The hero's primary action: "Plan Your Visit", label and href as nav-config carries them. The
 *  header's Tickets button is the one ticket action on these pages, so the hero has no ticket CTA. */
const HUB_PLAN_LINK = {
  label: HUB_MEGA?.columns.flatMap((c) => c.links).find((l) => l.id === 'plan-your-visit')?.label ?? 'Plan your visit',
  href: HUB_MEGA?.columns.flatMap((c) => c.links).find((l) => l.id === 'plan-your-visit')?.href ?? '/national-show/plan-your-visit',
};

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
    description: 'Previous editions.',
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
      { href: '/national-show/vendors', label: 'Exhibitors and Vendors' },
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

export default async function NationalShowPage() {
  const [sanityClasses, sanityShow, visitorInfo, salesState, admissionTicketTypes] =
    await Promise.all([
      sanityFetch<SanityShowClass[]>({ query: showClassesQuery, tags: ['showClass', 'sanity'] }),
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

  return (
    <>
      {eventData ? <JsonLd data={eventData} /> : null}

      {/* ── Hero — practical facts and the booking path live here, above the
          narrative (Kew pattern from research item 3: a visitor's first
          question is "can I come and what does it cost"). ── */}
      <NosHero
        image="/images/orchid-dark.jpg"
        priority
        // The `<h1>` is real text from nav-config (the NOS header carries the lockup; the hub
        // hero carries none). No eyebrow: ruling 2026-10-15 Q4.
        title={HUB_HEADING}
        titleSize="display"
        lede={HERO_LEDE}
        actions={
          <>
            {/* 2x2 at every width (Codi's legibility ruling 2026-09-29; mock
                index.html:145 `.hero-facts`). Rendered as a direct child of the hero
                body so the stacked order can move it after the CTAs (I:307). */}
            <dl className="nos-hero-facts">
              {heroMeta.map(({ label, value }, index) => (
                <div key={label}>
                  <dt data-nos-hero-text={`meta-dt-${index}`}>{label}</dt>
                  <dd data-nos-hero-text={`meta-dd-${index}`}>{value}</dd>
                </div>
              ))}
            </dl>

            {/* The dates above are our working assumption, not a committee decision.
                An unmarked plausible date range is exactly the invention this section
                must not ship — the marker is driven by showVisitorInfo.confirmations. */}
            {/* `contents`: no box of its own, so a confirmed status (badge
                renders nothing) adds no empty flex item to the body grid. */}
            <div data-nos-hero-text="confirmation-badge" className="contents">
              <ConfirmationBadge
                status={datesStatus}
                pendingLabel={visitorInfo?.pendingLabel}
                researchLabel={visitorInfo?.researchLabel}
                tone="dark"
              />
            </div>

            {/* Three actions, one grammar (F22). These were a filled Button plus
                two underlined inline links: three different heights, three
                different type sizes and two different hit areas for what are
                three peer destinations. Secondary is expressed by fill alone
                now — `ghost-on-dark` shares every metric with `on-dark` (same
                padding, same 15px label, same 2px radius), so the row reads as
                one control group and each target clears the same touch area. */}
            <div className="nos-hero-actions">
              <Button<typeof Link> as={Link} href={HUB_PLAN_LINK.href} variant="on-dark" data-nos-hero-button="">
                <span data-nos-hero-text="btn-primary-label">{HUB_PLAN_LINK.label}</span>
              </Button>
              <Button<typeof Link> as={Link} href="/societies" variant="ghost-on-dark" data-nos-hero-button="">
                <span data-nos-hero-text="btn-societies-label">Find your society</span>
              </Button>
            </div>

            <div>
              {/* Directly below the CTAs (ruling 2026-10-15 Q1/Q2). The label is the Karla
                  label role, like the countdown's own unit labels. */}
              <p
                data-nos-hero-text="countdown-opens-in"
                className="mb-3 font-sans text-[12px] font-bold uppercase tracking-[0.14em] text-ivory/90"
              >
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
          </>
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
            { value: '3 yr', label: 'Cycle' },
            { value: '10', label: 'Judging classes' },
          ].map(({ value, label }) => (
            <div key={label} className="bg-parchment px-8 py-10">
              <div className="nos-figure font-serif text-[46px] text-primary">
                {value}
              </div>
              <div className="mt-2 font-sans text-[12px] font-medium tracking-[0.16em] text-muted">
                {label}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Planning a visit — the section's front door (F5 reachability) ── */}
      <section className="mx-auto max-w-[1280px] px-8 pb-8">
        <SectionHeading eyebrow="Coming to the show" title="Planning a visit" />
        {/* R13 (Codi item 6, F2): 5 cards in a hardcoded 4-col grid orphaned the
            last row (5 mod 4 = 1). Derived via the same resolveGridLayout helper
            every other card grid in this file already uses, rather than a new
            hardcoded literal — resolveGridLayout(5).columns === 3 (5 mod 3 = 2
            holds), so this becomes a 3-column grid at lg. */}
        <ul
          className={`mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 ${COLUMN_CLASS[resolveGridLayout(VISITOR_CARDS.length).columns]}`}
        >
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
              className="inline-flex min-h-[44px] items-center font-sans text-[14px] font-medium text-ivory underline decoration-ivory/40 underline-offset-4 transition-colors duration-150 hover:decoration-ivory"
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
