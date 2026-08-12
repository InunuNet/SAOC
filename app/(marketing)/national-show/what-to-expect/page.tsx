import type { Metadata } from 'next';
import Link from 'next/link';

import { PageHero } from '@/components/ui/PageHero';
import { ConfirmationBadge, ShowSectionNav, VisitorInfoBlock } from '@/components/show';
import { sanityFetch } from '@/sanity/lib/fetch';
import { nationalShowVenueQuery, showVisitorInfoQuery } from '@/sanity/queries';
import type { ShowVisitorInfo } from '@/types';

// Bound CDN staleness to 60s, matching every other CMS-backed route on the site.
export const revalidate = 60;

export const metadata: Metadata = {
  title: 'What to Expect — National Orchid Show',
  description:
    'Opening hours, admission, food, photography, cloakroom and accessibility at the South ' +
    'African National Orchid Show.',
};

interface ShowDatesData {
  showDate: string | null;
  showEndDate: string | null;
}

// Fixed to the show's own timezone so the rendered range does not shift with the
// server's locale — a date that changes between environments is a bug, not a nicety.
const DATE_ZONE = 'Africa/Johannesburg';

function formatDateRange(start?: string | null, end?: string | null): string | null {
  if (!start) return null;
  const from = new Date(start);
  if (Number.isNaN(from.getTime())) return null;

  const long = new Intl.DateTimeFormat('en-ZA', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: DATE_ZONE,
  });
  if (!end) return long.format(from);

  const to = new Date(end);
  if (Number.isNaN(to.getTime())) return long.format(from);

  const day = new Intl.DateTimeFormat('en-ZA', { day: 'numeric', timeZone: DATE_ZONE });
  return `${day.format(from)}–${long.format(to)}`;
}

export default async function WhatToExpectPage() {
  const [info, show] = await Promise.all([
    sanityFetch<ShowVisitorInfo>({
      query: showVisitorInfoQuery,
      tags: ['showVisitorInfo', 'sanity'],
    }),
    sanityFetch<ShowDatesData>({ query: nationalShowVenueQuery, tags: ['nationalShow', 'sanity'] }),
  ]);

  const pendingLabel = info?.pendingLabel;
  const researchLabel = info?.researchLabel;
  const status = info?.confirmations ?? {};
  const dateRange = formatDateRange(show?.showDate, show?.showEndDate);
  const openingHours = (info?.openingHours ?? []).filter((entry) => entry?.label);

  return (
    <>
      <PageHero
        image="/images/orchid-yellow.jpg"
        eyebrow="National Show"
        heading={info?.expectTitle ?? 'What to expect'}
        lede={info?.expectIntro ?? undefined}
      />

      <div className="mx-auto max-w-[1280px] space-y-10 px-8 py-16">
        {dateRange ? (
          <section>
            <h2 className="font-serif text-[clamp(26px,3vw,36px)] font-medium text-ink">
              Show dates
            </h2>
            <p className="mt-3 font-serif text-[28px] text-primary">{dateRange}</p>
            <ConfirmationBadge
              status={status.dates}
              pendingLabel={pendingLabel}
              researchLabel={researchLabel}
            />
          </section>
        ) : null}

        {openingHours.length > 0 ? (
          <section className="border-t border-rule pt-8">
            <h3 className="font-serif text-[24px] font-medium text-ink">Opening hours</h3>
            <ConfirmationBadge
              status={status.openingHours}
              pendingLabel={pendingLabel}
              researchLabel={researchLabel}
            />
            <dl className="mt-4 grid grid-cols-1 gap-px bg-rule sm:grid-cols-2">
              {openingHours.map((entry, index) => (
                <div key={entry._key ?? `${entry.label}-${index}`} className="bg-parchment p-5">
                  <dt className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted">
                    {entry.label}
                  </dt>
                  <dd className="mt-1 font-serif text-[20px] text-ink">{entry.hours}</dd>
                  {entry.note ? (
                    <p className="mt-2 font-sans text-[13px] leading-snug text-ink/60">
                      {entry.note}
                    </p>
                  ) : null}
                </div>
              ))}
            </dl>
          </section>
        ) : null}

        <VisitorInfoBlock
          heading="Admission"
          body={info?.admissionNote}
          status={status.admission}
          pendingLabel={pendingLabel}
          researchLabel={researchLabel}
        >
          <Link
            href="/tickets"
            className="mt-4 inline-block bg-primary px-6 py-3 font-sans text-[14px] font-medium text-ivory transition-colors duration-150 hover:bg-primary-800"
          >
            {info?.admissionLinkLabel ?? 'See ticket prices and book'} →
          </Link>
        </VisitorInfoBlock>

        <VisitorInfoBlock
          heading="Food and refreshments"
          body={info?.food}
          status={status.food}
          pendingLabel={pendingLabel}
          researchLabel={researchLabel}
        />

        <VisitorInfoBlock
          heading="Photography"
          body={info?.photographyPolicy}
          status={status.photography}
          pendingLabel={pendingLabel}
          researchLabel={researchLabel}
        />

        <VisitorInfoBlock
          heading="Cloakroom and plant holding"
          body={info?.cloakroom}
          status={status.cloakroom}
          pendingLabel={pendingLabel}
          researchLabel={researchLabel}
        />

        <VisitorInfoBlock
          heading="Accessibility"
          body={info?.accessibility}
          status={status.accessibility}
          pendingLabel={pendingLabel}
          researchLabel={researchLabel}
        />
      </div>

      <ShowSectionNav current="/national-show/what-to-expect" />
    </>
  );
}
