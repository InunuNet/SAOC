import type { Metadata } from 'next';
import Link from 'next/link';

import {
  AccommodationList,
  ConfirmationBadge,
  ShowSectionNav,
  TravelRoutes,
  VenueCard,
  VisitorInfoBlock,
} from '@/components/show';
import { Button } from '@/components/nos/Button';
import { Card } from '@/components/nos/Card';
import { CtaBand } from '@/components/nos/CtaBand';
import { NosHero } from '@/components/nos/NosHero';
import { SectionHeading } from '@/components/nos/SectionHeading';
import { sanityFetch } from '@/sanity/lib/fetch';
import { nationalShowVenueQuery, showVisitorInfoQuery } from '@/sanity/queries';
import { buildPageMetadata } from '@/lib/seo';
import type { ShowVenue, ShowVisitorInfo } from '@/types';

// Bound CDN staleness to 60s, matching every other CMS-backed route on the site.
export const revalidate = 60;

export const metadata: Metadata = buildPageMetadata({
  title: 'Plan Your Visit — National Orchid Show',
  description:
    'Getting to the South African National Orchid Show: travel from the airports, parking, ' +
    'public transport, where to stay and what else to see while you are in town.',
  path: '/national-show/plan-your-visit',
});

interface ShowVenueData {
  venue: ShowVenue | null;
}

export default async function PlanYourVisitPage() {
  const [info, show] = await Promise.all([
    sanityFetch<ShowVisitorInfo>({
      query: showVisitorInfoQuery,
      tags: ['showVisitorInfo', 'sanity'],
    }),
    sanityFetch<ShowVenueData>({ query: nationalShowVenueQuery, tags: ['nationalShow', 'sanity'] }),
  ]);

  const pendingLabel = info?.pendingLabel;
  const researchLabel = info?.researchLabel;
  const status = info?.confirmations ?? {};
  const attractions = (info?.attractions ?? []).filter((a) => a?.name);
  const emergencyContacts = (info?.emergencyContacts ?? []).filter((c) => c?.label);

  return (
    <>
      <NosHero
        image="/images/orchid-violet.jpg"
        eyebrow="National Show"
        title={info?.planTitle ?? 'Plan your visit'}
        lede={info?.planIntro ?? undefined}
        priority
      />

      <div className="mx-auto max-w-[1280px] space-y-12 px-8 py-16">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <div className="space-y-10">
            <section>
              <SectionHeading as="h2" title="Getting there" lede={info?.gettingThereIntro ?? undefined} />
              <TravelRoutes routes={info?.airportRoutes} />
            </section>

            <VisitorInfoBlock
              heading="Parking"
              body={info?.parking}
              status={status.parking}
              pendingLabel={pendingLabel}
              researchLabel={researchLabel}
            />

            <VisitorInfoBlock
              heading="Public transport"
              body={info?.publicTransport}
              status={status.publicTransport}
              pendingLabel={pendingLabel}
              researchLabel={researchLabel}
            />
          </div>

          <VenueCard
            venue={show?.venue}
            status={status.venue}
            pendingLabel={pendingLabel}
            researchLabel={researchLabel}
          />
        </div>

        <VisitorInfoBlock
          heading="Where to stay"
          body={info?.accommodationIntro}
          status={status.accommodation}
          pendingLabel={pendingLabel}
          researchLabel={researchLabel}
        >
          <AccommodationList options={info?.accommodation} />
        </VisitorInfoBlock>

        {attractions.length > 0 ? (
          <section className="border-t border-rule pt-8">
            <SectionHeading as="h3" title="While you are here" />
            <ConfirmationBadge
              status={status.attractions}
              pendingLabel={pendingLabel}
              researchLabel={researchLabel}
            />
            <ul className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {attractions.map((attraction, index) => (
                <li key={attraction._key ?? `${attraction.name}-${index}`}>
                  <Card className="h-full">
                    <p className="font-serif text-[18px] font-medium text-ink">{attraction.name}</p>
                    {attraction.note ? (
                      <p className="mt-2 font-sans text-[14px] leading-relaxed text-muted">
                        {attraction.note}
                      </p>
                    ) : null}
                    {attraction.url ? (
                      <a
                        href={attraction.url}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="mt-3 inline-block font-sans text-[13px] underline underline-offset-2 hover:text-accent"
                      >
                        Visit website ↗
                      </a>
                    ) : null}
                  </Card>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {emergencyContacts.length > 0 ? (
          <section className="border-t border-rule pt-8">
            <SectionHeading as="h3" title="In an emergency" />
            <ConfirmationBadge
              status={status.emergencyContacts}
              pendingLabel={pendingLabel}
              researchLabel={researchLabel}
            />
            <dl className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {emergencyContacts.map((contact, index) => (
                <Card key={contact._key ?? `${contact.label}-${index}`}>
                  <dt className="font-sans text-[11px] font-medium uppercase tracking-[0.16em] text-muted">
                    {contact.label}
                  </dt>
                  <dd className="mt-1 font-serif text-[26px] font-medium text-primary">
                    {contact.number}
                  </dd>
                  {contact.note ? (
                    <p className="mt-2 font-sans text-[13px] leading-snug text-muted">
                      {contact.note}
                    </p>
                  ) : null}
                </Card>
              ))}
            </dl>
          </section>
        ) : null}
      </div>

      <CtaBand
        eyebrow="Stay informed"
        title="Be the first to know"
        lede="Parking, public transport and accommodation are confirmed by the show committee as the event draws closer. Ask the council to be notified the moment they are settled, or point out anything missing here."
        action={
          <Button as={Link} href="/contact" variant="on-dark">
            Ask the council
          </Button>
        }
      />

      <ShowSectionNav current="/national-show/plan-your-visit" />
    </>
  );
}
