import type { Metadata } from 'next';
import Link from 'next/link';

import { ConfirmationBadge, ShowSectionNav, VisitorInfoBlock } from '@/components/show';
import { Button } from '@/components/nos/Button';
import { Card } from '@/components/nos/Card';
import { NosHero } from '@/components/nos/NosHero';
import { SectionHeading } from '@/components/nos/SectionHeading';
import { sanityFetch } from '@/sanity/lib/fetch';
import { nationalShowVenueQuery, showVisitorInfoQuery } from '@/sanity/queries';
import { buildPageMetadata } from '@/lib/seo';
import type { ShowVisitorInfo } from '@/types';

// Bound CDN staleness to 60s, matching every other CMS-backed route on the site.
export const revalidate = 60;

export const metadata: Metadata = buildPageMetadata({
  title: 'What to Expect — National Orchid Show',
  description:
    'Opening hours, admission, food, photography, cloakroom and accessibility at the South ' +
    'African National Orchid Show.',
  path: '/national-show/what-to-expect',
});

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
      <NosHero
        image="/images/orchid-yellow.jpg"
        eyebrow="National Show"
        title={info?.expectTitle ?? 'What to expect'}
        lede={info?.expectIntro ?? undefined}
        priority
      />

      {/* Narrative content sourced verbatim from
          docs/leeann-source/what-to-expect_2026-09-09.md (Drive: "3.1 Info - What to
          Expect.docx", snapshot 2026-09-09) — the pre-existing sections below (dates,
          hours, admission, food, etc.) are Sanity-driven visitor logistics and stay as
          they are; this section adds the doc's narrative, which the page previously
          carried none of. Do not paraphrase or tighten this copy — see
          docs/rules/no-invention.md. */}
      <div className="mx-auto max-w-[900px] space-y-6 px-8 pt-16">
        <p className="font-sans text-[16px] leading-relaxed text-ink/80">
          The 2027 South African National Orchid Show promises an immersive experience celebrating the beauty, science and future of orchids.
        </p>

        <p className="font-sans text-[16px] leading-relaxed text-ink/80">
          Explore breathtaking displays showcasing thousands of flowering orchids, from rare species found in nature to award-winning
          cultivated hybrids that demonstrate decades of careful breeding and horticultural achievement. Watch South Africa&rsquo;s
          leading judges evaluate exceptional plants as exhibitors compete for prestigious national awards that recognise excellence in
          orchid cultivation.
        </p>

        <p className="font-sans text-[16px] leading-relaxed text-ink/80">
          Browse the extensive plant sales area, where specialist nurseries from across South Africa will be joined by selected
          international orchid vendors, offering an exceptional range of orchid species, hybrids, companion plants, growing media and
          specialist supplies. Whether you are purchasing your very first orchid or searching for a rare collector&rsquo;s specimen,
          knowledgeable growers from around the world will be on hand to share their expertise and passion.
        </p>

        <p className="font-sans text-[16px] leading-relaxed text-ink/80">
          The National Show Symposium will feature an outstanding programme of presentations by respected local and international
          speakers covering orchid cultivation, breeding, conservation, taxonomy, judging, sustainability and emerging scientific
          research. Integrated throughout the symposium, presentations by Wild Orchids of Southern Africa (WOSA) will highlight the ecology and conservation of indigenous orchids,
          illustrating how research undertaken in natural habitats continues to influence cultivation practices, breeding programmes and
          the long-term future of orchids.
        </p>

        {/* WOSA is credited as a hosted guest presenting within the symposium, per
            CLAUDE.md's scope boundary and docs/rules/no-invention.md — SAOC attributes
            and links out, it never authors conservation content in its own voice. */}
        <p className="border-t border-rule pt-6 font-sans text-[15px] leading-relaxed text-ink/70">
          SAOC focuses on orchids in cultivation. For wild orchid identification, habitat and
          conservation, visit our partner organisation{' '}
          <a
            href="https://wildorchids.co.za"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-link"
          >
            Wild Orchids of Southern Africa (WOSA)
          </a>
          .
        </p>

        <p className="font-sans text-[16px] leading-relaxed text-ink/80">
          Visitors can further develop their knowledge through practical workshops, meet orchid societies from across the country,
          engage with researchers and conservationists, and discover how every aspect of the National Show reflects this
          year&rsquo;s theme—from the protection of orchids in the wild to the pursuit of cultivated excellence.
        </p>

        <p className="font-sans text-[16px] leading-relaxed text-ink/80">
          The 2027 National Show is made possible through the generous support of our headline sponsors, donors and partners, whose
          commitment to horticulture, conservation, education and scientific advancement enables the South African Orchid Council to
          present a truly world-class event.
        </p>

        <p className="font-sans text-[16px] leading-relaxed text-ink/80">
          Whether your passion lies in conservation, scientific discovery, judging, growing or simply enjoying the extraordinary beauty
          of orchids, the 2027 South African National Orchid Show offers an unforgettable experience that celebrates the complete
          journey of orchids and the people dedicated to their future.
        </p>
      </div>

      <div className="mx-auto max-w-[1280px] space-y-10 px-8 py-16">
        {dateRange ? (
          <section>
            <SectionHeading as="h2" title="Show dates" />
            <p className="mt-3 font-serif text-[28px] font-medium text-primary">{dateRange}</p>
            <ConfirmationBadge
              status={status.dates}
              pendingLabel={pendingLabel}
              researchLabel={researchLabel}
            />
          </section>
        ) : null}

        {openingHours.length > 0 ? (
          <section className="border-t border-rule pt-8">
            <SectionHeading as="h3" title="Opening hours" />
            <ConfirmationBadge
              status={status.openingHours}
              pendingLabel={pendingLabel}
              researchLabel={researchLabel}
            />
            <dl className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {openingHours.map((entry, index) => (
                <Card key={entry._key ?? `${entry.label}-${index}`}>
                  <dt className="font-sans text-[11px] font-medium uppercase tracking-[0.16em] text-muted">
                    {entry.label}
                  </dt>
                  <dd className="mt-1 font-serif text-[22px] font-medium text-ink">{entry.hours}</dd>
                  {entry.note ? (
                    <p className="mt-2 font-sans text-[13px] leading-snug text-muted">
                      {entry.note}
                    </p>
                  ) : null}
                </Card>
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
          <Button as={Link} href="/tickets" className="mt-4">
            {info?.admissionLinkLabel ?? 'See ticket prices and book'} →
          </Button>
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
