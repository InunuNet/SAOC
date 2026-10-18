import type { Metadata } from 'next';
import Link from 'next/link';
import { connection } from 'next/server';

import { ConfirmationBadge, ShowHoldingNote, VisitorInfoBlock } from '@/components/show';
import { carriesUnsourcedVisitorText } from '@/components/show/ShowHoldingNote';
import { Button } from '@/components/nos/Button';
import { Card } from '@/components/nos/Card';
import { LongFormPage } from '@/components/nos/LongFormPage';
import { NosHero } from '@/components/nos/NosHero';
import { NosSection } from '@/components/nos/NosSection';
import { SectionHeading } from '@/components/nos/SectionHeading';
import { sanityFetch } from '@/sanity/lib/fetch';
import { nationalShowQuery, showVisitorInfoQuery } from '@/sanity/queries';
import { buildShowFacts, type ShowFactsSource } from '@/lib/data/show-facts';
import { withholdPlaceholderProse } from '@/lib/data/show-pages';
import { buildPageMetadata } from '@/lib/seo';
import type { ShowVisitorInfo } from '@/types';
import { nosOgImage } from '@/app/(marketing)/national-show/og-image';
import { NosShowIndex } from '@/components/nos/NosShowIndex';

// Bound CDN staleness to 60s, matching every other CMS-backed route on the site.
export const revalidate = 60;

export const metadata: Metadata = buildPageMetadata({
  title: 'What to Expect',
  image: nosOgImage('What to Expect — National Orchid Show'),
  description:
    'Opening hours, admission, food, photography, cloakroom and accessibility at the South ' +
    'African National Orchid Show.',
  path: '/national-show/what-to-expect',
});

// Fixed to the show's own timezone so the rendered range does not shift with the
// server's locale — a date that changes between environments is a bug, not a nicety.
const DATE_ZONE = 'Africa/Johannesburg';

function formatDateRange(start?: string | null, end?: string | null): string | null {
  if (!start) return null;
  const from = new Date(start);
  if (Number.isNaN(from.getTime())) return null;

  const part = (
    date: Date,
    options: Intl.DateTimeFormatOptions,
    type: Intl.DateTimeFormatPartTypes
  ) =>
    new Intl.DateTimeFormat('en-ZA', { ...options, timeZone: DATE_ZONE })
      .formatToParts(date)
      .find((entry) => entry.type === type)?.value ?? '';
  const weekday = (date: Date) => part(date, { weekday: 'long' }, 'weekday');
  const day = (date: Date) => part(date, { day: 'numeric' }, 'day');
  const month = (date: Date) => part(date, { month: 'long' }, 'month');
  const year = (date: Date) => part(date, { year: 'numeric' }, 'year');
  const full = (date: Date) => `${weekday(date)} ${day(date)} ${month(date)} ${year(date)}`;

  const to = end ? new Date(end) : null;
  if (!to || Number.isNaN(to.getTime())) return full(from);

  // Same month and year: the month and year are said once, after the second date.
  const sameMonth = month(from) === month(to) && year(from) === year(to);
  const first = sameMonth ? `${weekday(from)} ${day(from)}` : full(from);
  return `${first} to ${full(to)}`;
}

const HEADING_HOURS = 'Opening hours';
const HEADING_ADMISSION = 'Admission';
const HEADING_FOOD = 'Food and refreshments';
const HEADING_PHOTOGRAPHY = 'Photography';
const HEADING_CLOAKROOM = 'Cloakroom and plant holding';

export default async function WhatToExpectPage() {
  // The public-versus-preview switch reads the environment, so this page renders per request
  // rather than being frozen at build time with whichever setting the build happened to have.
  await connection();
  const [info, show] = await Promise.all([
    sanityFetch<ShowVisitorInfo>({
      query: showVisitorInfoQuery,
      tags: ['showVisitorInfo', 'sanity'],
    }),
    sanityFetch<ShowFactsSource>({ query: nationalShowQuery, tags: ['nationalShow', 'sanity'] }),
  ]);

  const pendingLabel = info?.pendingLabel;
  const researchLabel = info?.researchLabel;
  const status = info?.confirmations ?? {};
  const dateRange = formatDateRange(show?.showDate, show?.showEndDate);
  const facts = buildShowFacts(show);
  // Public build: unconfirmed rows are withheld and named once; preview shows every block as today.
  const publicMode = withholdPlaceholderProse();
  const confirmed = (value?: string | null) => value === 'confirmed';
  const openingHours = (info?.openingHours ?? []).filter((entry) => entry?.label);
  // The photography text and the concession lines in the admission note have no Drive source,
  // so a public build withholds them even when Sanity marks the block confirmed.
  const admissionNote =
    publicMode && carriesUnsourcedVisitorText(info?.admissionNote) ? null : info?.admissionNote;
  const photography =
    publicMode && carriesUnsourcedVisitorText(info?.photographyPolicy)
      ? null
      : info?.photographyPolicy;
  // An unconfirmed block already carries its one status line; an hours value that only repeats
  // that line ("To be confirmed") is left out so the block does not say it twice.
  const restatesStatus = (hours?: string | null) =>
    !confirmed(status.openingHours) &&
    !!hours?.trim() &&
    !!pendingLabel?.toLowerCase().startsWith(hours.trim().toLowerCase());
  // A row whose hours only restate the status line is left out whole (its term and its value).
  const hoursRows = openingHours.filter((entry) => !restatesStatus(entry.hours));
  // Each logistics block in page order: whether it renders at all, and whether it is confirmed.
  const blocks = [
    { heading: HEADING_HOURS, present: openingHours.length > 0, status: status.openingHours },
    { heading: HEADING_ADMISSION, present: true, status: status.admission },
    { heading: HEADING_FOOD, present: !!info?.food, status: status.food },
    {
      heading: HEADING_PHOTOGRAPHY,
      present: !!info?.photographyPolicy,
      status: status.photography,
    },
    { heading: HEADING_CLOAKROOM, present: !!info?.cloakroom, status: status.cloakroom },
    {
      heading: 'Accessibility',
      present: !!info?.accessibility,
      status: status.accessibility,
    },
  ];
  const heldBack = publicMode
    ? blocks
        .filter((block) => block.present && !confirmed(block.status))
        .map((block) => block.heading)
    : [];
  const visible = (heading: string) => !heldBack.includes(heading);

  return (
    <>
      <NosHero
        route="/national-show/what-to-expect"
        title={info?.expectTitle ?? 'What to expect'}
        lede={publicMode ? undefined : (info?.expectIntro ?? undefined)}
        priority
      />

      <NosSection wrapClassName="space-y-10 [&_p]:max-w-[60ch]">
        {dateRange ? (
          <section className="nos-surface">
            <SectionHeading as="h2" title="Show dates" />
            <p className="meta mt-3 font-serif text-[28px] font-medium text-primary">{dateRange}</p>
            <ConfirmationBadge
              status={status.dates}
              pendingLabel={pendingLabel}
              researchLabel={researchLabel}
            />
          </section>
        ) : null}

        {heldBack.length > 0 ? (
          <ShowHoldingNote hidden={heldBack} pendingLabel={pendingLabel} />
        ) : null}

        {openingHours.length > 0 && visible(HEADING_HOURS) ? (
          <section className="nos-surface">
            <SectionHeading as="h2" title={HEADING_HOURS} />
            <ConfirmationBadge
              status={status.openingHours}
              pendingLabel={pendingLabel}
              researchLabel={researchLabel}
            />
            {hoursRows.length > 0 ? (
              <dl className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                {hoursRows.map((entry, index) => (
                  <Card key={entry._key ?? `${entry.label}-${index}`}>
                    <dt className="font-sans text-[12px] font-semibold uppercase tracking-[0.16em] text-muted">
                      {entry.label}
                    </dt>
                    <dd className="mt-1 font-serif text-[22px] font-medium text-ink">
                      {entry.hours}
                    </dd>
                    {entry.note ? (
                      <p className="mt-2 font-sans text-[length:var(--fs-body,1rem)] leading-[1.55] text-muted">
                        {entry.note}
                      </p>
                    ) : null}
                  </Card>
                ))}
              </dl>
            ) : null}
          </section>
        ) : null}

        {visible(HEADING_ADMISSION) ? (
          <VisitorInfoBlock
            heading={HEADING_ADMISSION}
            headingLevel="h2"
            body={admissionNote}
            status={status.admission}
            pendingLabel={pendingLabel}
            researchLabel={researchLabel}
          >
            <Button as={Link} href="/national-show/tickets" className="mt-4">
              {info?.admissionLinkLabel ?? 'See ticket prices and book'} →
            </Button>
          </VisitorInfoBlock>
        ) : null}

        {visible(HEADING_FOOD) ? (
          <VisitorInfoBlock
            heading={HEADING_FOOD}
            headingLevel="h2"
            body={info?.food}
            status={status.food}
            pendingLabel={pendingLabel}
            researchLabel={researchLabel}
          />
        ) : null}

        {visible(HEADING_PHOTOGRAPHY) ? (
          <VisitorInfoBlock
            heading={HEADING_PHOTOGRAPHY}
            headingLevel="h2"
            body={photography}
            status={status.photography}
            pendingLabel={pendingLabel}
            researchLabel={researchLabel}
          />
        ) : null}

        {visible(HEADING_CLOAKROOM) ? (
          <VisitorInfoBlock
            heading={HEADING_CLOAKROOM}
            headingLevel="h2"
            body={info?.cloakroom}
            status={status.cloakroom}
            pendingLabel={pendingLabel}
            researchLabel={researchLabel}
          />
        ) : null}

        {visible('Accessibility') ? (
          <VisitorInfoBlock
            heading="Accessibility"
            headingLevel="h2"
            body={info?.accessibility}
            status={status.accessibility}
            pendingLabel={pendingLabel}
            researchLabel={researchLabel}
          />
        ) : null}
      </NosSection>

      {/* Narrative content sourced verbatim from
          docs/leeann-source/what-to-expect_2026-09-09.md (Drive: "3.1 Info - What to
          Expect.docx", snapshot 2026-09-09) — the pre-existing sections above (dates,
          hours, admission, food, etc.) are Sanity-driven visitor logistics and stay as
          they are; this section adds the doc's narrative, which the page previously
          carried none of. Do not paraphrase or tighten this copy — see
          docs/rules/no-invention.md. */}
      <NosSection>
        <LongFormPage
          facts={dateRange ? facts.filter((fact) => fact.label !== 'Dates') : facts}
          paragraphs={[
            <>
              The 2027 South African National Orchid Show promises an immersive experience
              celebrating the beauty, science and future of orchids.
            </>,
            <>
              Explore breathtaking displays showcasing thousands of flowering orchids, from rare
              species found in nature to award-winning cultivated hybrids that demonstrate decades
              of careful breeding and horticultural achievement. Watch South Africa&rsquo;s leading
              judges evaluate exceptional plants as exhibitors compete for prestigious national
              awards that recognise excellence in orchid cultivation.
            </>,
            <>
              Browse the extensive plant sales area, where specialist nurseries from across South
              Africa will be joined by selected international orchid vendors, offering an
              exceptional range of orchid species, hybrids, companion plants, growing media and
              specialist supplies. Whether you are purchasing your very first orchid or searching
              for a rare collector&rsquo;s specimen, knowledgeable growers from around the world
              will be on hand to share their expertise and passion.
            </>,
            <>
              The National Show Symposium will feature an outstanding programme of presentations by
              respected local and international speakers covering orchid cultivation, breeding,
              conservation, taxonomy, judging, sustainability and emerging scientific research.
              Integrated throughout the symposium, presentations by Wild Orchids of Southern Africa
              (WOSA) will highlight the ecology and conservation of indigenous orchids, illustrating
              how research undertaken in natural habitats continues to influence cultivation
              practices, breeding programmes and the long-term future of orchids.
            </>,
            <>
              Visitors can further develop their knowledge through practical workshops, meet orchid
              societies from across the country, engage with researchers and conservationists, and
              discover how every aspect of the National Show reflects this year&rsquo;s theme—from
              the protection of orchids in the wild to the pursuit of cultivated excellence.
            </>,
            <>
              The 2027 National Show is made possible through the generous support of our headline
              sponsors, donors and partners, whose commitment to horticulture, conservation,
              education and scientific advancement enables the South African Orchid Council to
              present a truly world-class event.
            </>,
            <>
              Whether your passion lies in conservation, scientific discovery, judging, growing or
              simply enjoying the extraordinary beauty of orchids, the 2027 South African National
              Orchid Show offers an unforgettable experience that celebrates the complete journey of
              orchids and the people dedicated to their future.
            </>,
          ]}
        />
      </NosSection>
      <NosShowIndex current="/national-show/what-to-expect" />
    </>
  );
}
