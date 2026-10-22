import { Suspense, type ReactNode } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { NAV } from '@/components/chrome/nav-config';
import { ConfirmationBadge, ShowCountdown } from '@/components/show';
import { Button } from '@/components/nos/Button';
import { CtaBand } from '@/components/nos/CtaBand';
import { ExhibitorStageCard } from '@/components/nos/ExhibitorStageCard';
import { JudgingGroupCard } from '@/components/nos/JudgingGroupCard';
import { COLUMN_CLASS, SPAN_CLASS, resolveGridLayout } from '@/lib/grid-columns';
import { NosHero } from '@/components/nos/NosHero';
import { NosSection } from '@/components/nos/NosSection';
import { SectionHeading } from '@/components/nos/SectionHeading';
import { JsonLd, nationalShowEventJsonLd, type NationalShowOffer } from '@/components/seo/JsonLd';
import { sanityFetch } from '@/sanity/lib/fetch';
import {
  activeTicketTypesByCategoryQuery,
  showClassesQuery,
  nationalShowQuery,
  nationalShowSalesQuery,
  showVisitorInfoQuery,
} from '@/sanity/queries';
import { buildShowFacts } from '@/lib/data/show-facts';
import { withholdPlaceholderProse } from '@/lib/data/show-pages';
import { showClasses as staticClasses } from '@/lib/data/showClasses';
import { cheapestAdmission, formatRand } from '@/components/nos/cheapest-admission';
import { effectiveCapacity, resolveEffectivePrice } from '@/lib/checkout-reservation';
import { buildPageMetadata } from '@/lib/seo';
import {
  formatShowMonthYear,
  formatVenueAddress,
  toOrdinal,
  toShowIsoDate,
} from '@/lib/show-identity';
import type { ShowClass, ShowVenue, ShowVisitorInfo } from '@/types';
import type { SanityImageSource } from '@sanity/image-url';
import { nosOgImage } from '@/app/(nos)/national-show/og-image';

// F1 cms-loop: bound CDN staleness to 60s (no programmatic purge API exists for
// Firebase App Hosting — see docs/f1-cdn-purge-api-findings.md) so a Sanity publish
// propagates within F6's 120s round-trip window. See contracts/cms-loop-f1-cdn-purge.yaml.
export const revalidate = 60;

// "from all nine provinces" is unsourced (no Drive document or Sanity record states it), so a public
// build drops the whole clause that carries it and keeps the rest verbatim; beta shows it all.
const WITHHOLD_UNSOURCED = withholdPlaceholderProse();

const PAGE_DESCRIPTION_LEAD =
  'The South African National Orchid Show — the flagship triennial competition';
const PAGE_DESCRIPTION_CLAUSE =
  ' bringing together growers, judges and enthusiasts from all nine provinces';
const PAGE_DESCRIPTION = WITHHOLD_UNSOURCED
  ? `${PAGE_DESCRIPTION_LEAD}.`
  : `${PAGE_DESCRIPTION_LEAD}${PAGE_DESCRIPTION_CLAUSE}.`;

// Display-hero lede only (Brad, 2026-09-29): PAGE_DESCRIPTION repeats the
// lockup's "National Orchid Show" and the eyebrow's "flagship", so the hero
// carries this instead. Metadata and JSON-LD keep PAGE_DESCRIPTION.
const HERO_LEDE_LEAD = 'South Africa’s triennial orchid competition';
const HERO_LEDE_CLAUSE =
  ', bringing together growers, judges and enthusiasts from all nine provinces';
const heroLede = (chip: ReactNode) =>
  WITHHOLD_UNSOURCED ? (
    `${HERO_LEDE_LEAD}.`
  ) : (
    <>
      {HERO_LEDE_LEAD}
      <span data-placeholder="true">
        {HERO_LEDE_CLAUSE}.{chip}
      </span>
    </>
  );

// Sourced: Sanity holds exactly ten showClass documents.
const JUDGING_LEDE = 'Every exhibit is entered in one of ten botanical classes.';

export const metadata: Metadata = buildPageMetadata({
  title: 'National Orchid Show',
  image: nosOgImage('National Orchid Show'),
  description: PAGE_DESCRIPTION,
  path: '/national-show',
});

/** The hub's `<h1>` (R68, Brad): the show's plain name. nav-config keeps its own longer label
 *  as the mega-menu lead, so the two are deliberately separate. */
const HUB_HEADING = 'National Orchid Show';

const HUB_MEGA = NAV.find((n) => n.type === 'mega');

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
  now: Date
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

// C-4: ten judging groups lay out 5x2 from 1024px and 2x5 below it. Any count that divides by
// five keeps the five-up grid; anything else falls back to the derived, orphan-free layout.
const JUDGING_WIDE_COLUMNS = 5;

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
    description:
      'Travel from the airports, parking, public transport, where to stay and what else to see.',
  },
  {
    href: '/national-show/what-to-expect',
    title: 'What to expect',
    description: 'Opening hours, admission, food, photography, cloakroom and accessibility.',
  },
  {
    href: '/national-show/faq',
    title: 'Visitor questions',
    description:
      'The questions we are asked most, answered — and honestly marked where they are not yet settled.',
  },
  {
    href: '/national-show/archive',
    title: 'Past shows',
    description: 'Previous editions.',
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
  const edition = sanityShow?.edition ?? null;
  const monthYear = formatShowMonthYear(sanityShow?.showDate);
  const venueCity = sanityShow?.venue?.city ?? null;
  const datesStatus = visitorInfo?.confirmations?.dates;

  // One source for the four facts: the long-form template and the holding state read the same module.
  const heroMeta = buildShowFacts(sanityShow);

  // Every withheld-fact block carries its own visible chip (beta preview only; public renders none).
  const pendingChip = (tone: 'light' | 'dark') => (
    <span className="block">
      <ConfirmationBadge
        status="pending"
        pendingLabel={visitorInfo?.pendingLabel}
        tone={tone}
        as="span"
      />
    </span>
  );

  // The price anchor shows only while sales are open and the cheapest admission has a price.
  const anchor =
    salesState?.salesOpen === true
      ? cheapestAdmission(admissionTicketTypes ?? [], new Date())
      : null;
  const priceAnchor =
    anchor && anchor.price > 0 ? `${anchor.type.name} from ${formatRand(anchor.price)}` : null;

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
      ? sanityClasses.map((c) => ({
          id: c._id,
          code: c.code,
          name: c.name,
          group: '',
          description: c.description,
        }))
      : staticClasses;

  // R13 (goldens/m4/grid-orphan-rule.golden.md): text-bearing cards (JudgingGroupCard
  // carries a code badge, uppercase label, serif name and description) cap at 4 columns
  // — DERIVED from the live count, never a hardcoded `lg:grid-cols-N` literal, so a
  // future change in the number of judging groups can't silently reintroduce an orphan.
  const judgingGridLayout = resolveGridLayout(classes.length);
  const judgingColumnsClass =
    classes.length % JUDGING_WIDE_COLUMNS === 0
      ? 'lg:grid-cols-5'
      : COLUMN_CLASS[judgingGridLayout.columns];

  return (
    <>
      {eventData ? <JsonLd data={eventData} /> : null}

      {/* ── Hero — practical facts and the booking path live here, above the
          narrative (Kew pattern from research item 3: a visitor's first
          question is "can I come and what does it cost"). ── */}
      <NosHero
        route="/national-show"
        priority
        // The `<h1>` is real text (the NOS header carries the lockup; the hub hero carries none).
        // No eyebrow: ruling 2026-10-15 Q4.
        title={HUB_HEADING}
        titleSize="display"
        lede={heroLede(pendingChip('dark'))}
        actions={
          <>
            {/* Order at every width: CTAs, price, countdown, facts (C-2). R68: the CTA cluster
                and the countdown share one flex row (stacked under 640px). Tickets is the one
                primary; Plan your visit is the ghost beside it. */}
            <div className="nos-hero-row">
              <div className="nos-hero-cta-group">
                <div className="nos-hero-actions">
                  <Button<typeof Link>
                    as={Link}
                    href={TICKETS_CTA.href}
                    variant="on-dark"
                    data-nos-hero-button=""
                  >
                    <span data-nos-hero-text="btn-primary-label">{TICKETS_CTA.label}</span>
                  </Button>
                  <Button<typeof Link>
                    as={Link}
                    href={HUB_PLAN_LINK.href}
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

              <div>
                {/* The label is the Karla label role, like the countdown's own unit labels. */}
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
            </div>

            {/* 2x2 at every width (Codi's legibility ruling 2026-09-29; mock
                index.html:145 `.hero-facts`). */}
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
                must not ship — the marker is driven by showVisitorInfo.confirmations.
                `contents`: no box of its own, so a confirmed status (badge renders
                nothing) adds no empty flex item to the body grid. */}
            <div data-nos-hero-text="confirmation-badge" className="contents">
              <ConfirmationBadge
                status={datesStatus}
                pendingLabel={visitorInfo?.pendingLabel}
                researchLabel={visitorInfo?.researchLabel}
                tone="dark"
              />
            </div>
          </>
        }
      />

      {/* ── What it is ── */}
      <NosSection wrapClassName="nos-about">
        <div>
          <SectionHeading title="Three years in the making, four days on the bench" />
          <p className="mt-6 font-sans text-[16px] leading-[1.55] text-ink/80">
            The National Orchid Show is the country&rsquo;s premier competitive orchid event. Held
            every three years, it brings together growers, hybridisers, judges and collectors for
            four days of competition, education, and community.
          </p>
          {/* "against the 100-point scale" and the Grand Champion sentence are unsourced: a public
              build drops just those and keeps the rest of the paragraph; beta keeps all of it with
              a pending marker. */}
          <p className="mt-4 font-sans text-[16px] leading-[1.55] text-ink/80">
            Every plant is assessed by{' '}
            <Link href="/judging" className="text-[var(--accent)] underline underline-offset-2">
              accredited SAOC judges
            </Link>{' '}
            {WITHHOLD_UNSOURCED ? (
              <>across ten botanical classes.</>
            ) : (
              <span data-placeholder="true">
                against the 100-point scale across ten botanical classes. The Grand Champion is the
                highest-scoring exhibit across all classes.
                {pendingChip('light')}
              </span>
            )}
          </p>
        </div>

        {/* Figures row (v4 `.figures`): the sourced figures, plus the unsourced edition count on a
            beta preview only, where it carries the pending marker. */}
        <dl className="nos-figures">
          {[
            { value: '3 yr', label: 'Cycle', unsourced: false },
            { value: '10', label: 'Judging classes', unsourced: false },
            ...(WITHHOLD_UNSOURCED
              ? []
              : [{ value: '18', label: 'Editions held', unsourced: true }]),
          ].map(({ value, label, unsourced }) => (
            <div key={label} data-placeholder={unsourced ? 'true' : undefined}>
              <dt>
                <span>{label}</span>
                {unsourced ? pendingChip('light') : null}
              </dt>{' '}
              <dd className="nos-figure font-serif">{value}</dd>
            </div>
          ))}
        </dl>
      </NosSection>

      {/* ── Planning a visit — the hub's one destinations list (v4 pattern, I:176-190) ── */}
      <NosSection tone="gold" aria-labelledby="planning-title">
        <h2
          id="planning-title"
          className="nos-opsz-fluid font-serif text-[clamp(28px,3.6vw,44px)] leading-[1.1] text-ink"
        >
          Planning a visit
        </h2>
        <ul data-nos-destinations="">
          {VISITOR_CARDS.map(({ href, title: cardTitle, description }) => (
            <li key={href}>
              <Link href={href}>
                <strong>{cardTitle}</strong>
                <span>{description}</span>
                <i className="go" aria-hidden="true">
                  <svg
                    viewBox="0 0 24 24"
                    width="18"
                    height="18"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M9 5l7 7-7 7" />
                  </svg>
                </i>
              </Link>
            </li>
          ))}
        </ul>
      </NosSection>

      {/* ── Classes & Judging — a botanical index, not placeholder tiles ── */}
      <NosSection tone="gold" className="nos-section-joined">
        <SectionHeading
          title="Ten judging groups"
          lede={
            WITHHOLD_UNSOURCED ? (
              JUDGING_LEDE
            ) : (
              <>
                {JUDGING_LEDE}{' '}
                <span data-placeholder="true">
                  Judges score on a 100-point scale covering cultural quality, presentation, and
                  species accuracy.
                  {pendingChip('light')}
                </span>
              </>
            )
          }
        />

        <div className={`mt-10 grid grid-cols-2 gap-4 ${judgingColumnsClass}`}>
          {classes.map((cls, index) => {
            // Only the final card in the spanning tie-break case (n = 13, 25, 37, ...)
            // gets a span class — the exact case resolveGridLayout falls back to a
            // full-width final card for, rather than leaving a lone orphan in a
            // partial row. See components/show/nos/ShowEntityGrid.tsx for the same
            // pattern applied to entity listings.
            const isFinal = index === classes.length - 1;
            const isSpanningTieBreak =
              classes.length % JUDGING_WIDE_COLUMNS !== 0 && judgingGridLayout.finalCardSpans > 1;
            const spanClass =
              isFinal && isSpanningTieBreak ? SPAN_CLASS[judgingGridLayout.finalCardSpans] : '';
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
      </NosSection>

      {/* ── Exhibitor information (royal ground: NosSection tone="royal" carries nos-on-dark) ── */}
      <NosSection tone="royal">
        <SectionHeading title="Exhibitor information" tone="on-dark" />

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

        <div className="mt-14 flex flex-col items-start gap-5">
          <p className="font-serif text-[clamp(1.5rem,1.2rem+1.2vw,2rem)] leading-tight text-ivory">
            Start planning your entry now.
          </p>
          <p className="max-w-[58ch] font-sans text-[18px] leading-[1.55] text-[var(--lilac-muted)]">
            Register your interest through your society or contact the council directly.
          </p>
          <div className="flex flex-wrap gap-4">
            <Button<typeof Link> as={Link} href="/societies" variant="on-dark">
              Find your society
            </Button>
            <Button<typeof Link> as={Link} href="/national-show/exhibitors" variant="ghost-on-dark">
              Exhibitor information
            </Button>
          </div>
        </div>
      </NosSection>

      {/* ── Closing band: the ticket close. Its h2 is the show's own line from page data. ── */}
      <CtaBand
        className="nos-section-joined"
        title={ctaSentence}
        action={
          <div className="flex flex-wrap justify-center gap-4">
            <Button<typeof Link> as={Link} href={TICKETS_CTA.href} variant="on-dark">
              {TICKETS_CTA.label}
            </Button>
            <Button<typeof Link> as={Link} href={HUB_PLAN_LINK.href} variant="ghost-on-dark">
              {HUB_PLAN_LINK.label}
            </Button>
          </div>
        }
      />
    </>
  );
}
