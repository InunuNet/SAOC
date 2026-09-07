import { Suspense } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { ConfirmationBadge, ShowCountdown } from '@/components/show';
import { Button } from '@/components/nos/Button';
import { CtaBand } from '@/components/nos/CtaBand';
import { CycleStep } from '@/components/nos/CycleStep';
import { ExhibitorStageCard } from '@/components/nos/ExhibitorStageCard';
import { JudgingGroupCard } from '@/components/nos/JudgingGroupCard';
import { Logo } from '@/components/nos/Logo';
import { NosHero, NOS_HERO_IMAGES, type NosHeroImage } from '@/components/nos/NosHero';
import { PastEditionCard } from '@/components/nos/PastEditionCard';
import { SectionHeading } from '@/components/nos/SectionHeading';
import { VisitorLinkCard } from '@/components/nos/VisitorLinkCard';
import { sanityFetch } from '@/sanity/lib/fetch';
import {
  showClassesQuery,
  pastShowsQuery,
  nationalShowQuery,
  showVisitorInfoQuery,
} from '@/sanity/queries';
import { showClasses as staticClasses } from '@/lib/data/showClasses';
import { shows as staticShows } from '@/lib/data/shows';
import {
  formatShowDateRange,
  formatShowMonthYear,
  showYearOf,
  toOrdinal,
} from '@/lib/show-identity';
import type { ShowClass, NationalShow, ShowVenue, ShowVisitorInfo } from '@/types';
import type { SanityImageSource } from '@sanity/image-url';

// F1 cms-loop: bound CDN staleness to 60s (no programmatic purge API exists for
// Firebase App Hosting — see docs/f1-cdn-purge-api-findings.md) so a Sanity publish
// propagates within F6's 120s round-trip window. See contracts/cms-loop-f1-cdn-purge.yaml.
export const revalidate = 60;

export const metadata: Metadata = {
  title: 'National Orchid Show',
  description:
    'The South African National Orchid Show — the flagship triennial competition bringing together growers, judges and enthusiasts from all nine provinces.',
};

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
  const [sanityClasses, sanityShows, sanityShow, visitorInfo] = await Promise.all([
    sanityFetch<SanityShowClass[]>({ query: showClassesQuery, tags: ['showClass', 'sanity'] }),
    sanityFetch<SanityPastShow[]>({ query: pastShowsQuery, tags: ['show', 'sanity'] }),
    sanityFetch<SanityNationalShow>({ query: nationalShowQuery, tags: ['nationalShow', 'sanity'] }),
    sanityFetch<ShowVisitorInfo>({
      query: showVisitorInfoQuery,
      tags: ['showVisitorInfo', 'sanity'],
    }),
  ]);

  const title = sanityShow?.title || 'The South African National Orchid Show';
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

  const classes: ShowClass[] =
    sanityClasses && sanityClasses.length > 0
      ? sanityClasses.map((c) => ({ id: c._id, code: c.code, name: c.name, group: '', description: c.description }))
      : staticClasses;

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
      {/* ── Hero — practical facts and the booking path live here, above the
          narrative (Kew pattern from research item 3: a visitor's first
          question is "can I come and what does it cost"). ── */}
      <NosHero
        image="/images/orchid-violet.jpg"
        priority
        // The horizontal lockup carries the brand identity here, so the h1
        // below is left as the show's headline rather than restating the
        // wordmark — logo carries identity, h1 sits below it as the
        // headline (Brad, 2026-09-07). Its wordmark is real text, not baked
        // into an image, so it stays screen-reader reachable on its own.
        brandMark={
          // The horizontal lockup wraps "National Orchid Show" onto two
          // lines below ~640px, leaving the emblem sized for a two-line
          // wordmark next to a three-line one — cramped, and it crowds "The
          // Flagship" eyebrow right beneath it. Stack vertically below `sm`,
          // switch to the full horizontal lockup from `sm:` up.
          <>
            <Logo orientation="vertical" tone="on-dark" className="sm:hidden" />
            <Logo orientation="horizontal" tone="on-dark" className="hidden sm:flex" />
          </>
        }
        eyebrow="The Flagship"
        title={title}
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

            <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
              <Button<typeof Link> as={Link} href="/tickets" variant="on-dark">
                Book tickets →
              </Button>
              <Link
                href="/contact"
                className="font-sans text-[14px] font-medium text-ivory underline decoration-ivory/40 underline-offset-4 transition-colors duration-150 hover:decoration-ivory"
              >
                Register interest
              </Link>
              <Link
                href="/societies"
                className="font-sans text-[14px] font-medium text-ivory underline decoration-ivory/40 underline-offset-4 transition-colors duration-150 hover:decoration-ivory"
              >
                Find your society
              </Link>
            </div>

            <div>
              <p className="mb-3 font-sans text-[10px] font-medium uppercase tracking-[0.2em] text-ivory/45">
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

        <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {classes.map((cls, index) => (
            <JudgingGroupCard
              key={cls.id}
              code={cls.code}
              group={cls.group || `Group ${index + 1}`}
              name={cls.name}
              description={cls.description}
            />
          ))}
        </div>
      </section>

      {/* ── Exhibitor information ── */}
      <section className="bg-primary py-24">
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
    </>
  );
}
