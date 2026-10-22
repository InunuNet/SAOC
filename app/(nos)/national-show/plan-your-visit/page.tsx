import type { Metadata } from 'next';
import Link from 'next/link';

import { AccommodationList, TravelRoutes, VenueCard } from '@/components/show';
import { Button } from '@/components/nos/Button';
import { CtaBand } from '@/components/nos/CtaBand';
import { NosHero } from '@/components/nos/NosHero';
import { NosSection } from '@/components/nos/NosSection';
import { SectionHeading } from '@/components/nos/SectionHeading';
import {
  VisitAttractions,
  VisitEmergency,
  VisitGettingThere,
  gettingThereLede,
} from '@/components/show/VisitDisclosure';
import { sanityFetch } from '@/sanity/lib/fetch';
import { nationalShowVenueQuery, showVisitorInfoQuery } from '@/sanity/queries';
import { buildPageMetadata } from '@/lib/seo';
import type { ShowVenue, ShowVisitorInfo } from '@/types';
import { nosOgImage } from '@/app/(marketing)/national-show/og-image';
import { NosShowIndex } from '@/components/nos/NosShowIndex';

// Bound CDN staleness to 60s, matching every other CMS-backed route on the site.
export const revalidate = 60;

// The description is a single 161-char sentence, one over the limit, so the page's own intro
// (the same Sanity field the hero renders) stands in as the lede it is cut back to.
export async function generateMetadata(): Promise<Metadata> {
  const info = await sanityFetch<ShowVisitorInfo>({
    query: showVisitorInfoQuery,
    tags: ['showVisitorInfo', 'sanity'],
  });

  return buildPageMetadata({
    title: 'Plan your visit',
    image: nosOgImage('Plan your visit — National Orchid Show'),
    description:
      'Getting to the South African National Orchid Show: travel from the airports, parking, ' +
      'public transport, where to stay and what else to see while you are in town.',
    lede: info?.planIntro ?? undefined,
    path: '/national-show/plan-your-visit',
  });
}

// Codi P3 H8: the pending items on this page are grouped under ONE chip per disclosure, to the
// nos-v4/plan-your-visit.html golden (l.575-616). The Getting-there label lives in
// VisitDisclosure.tsx; the emergency label, which the golden also names, is defined here.
// The emergency section deviates from golden l.605-616 per Codi's FINAL ruling: the national
// numbers are plain, and only the on-site contact sits in the pale disclosure (VisitEmergency).
const EMERGENCY_LABEL = 'Emergency contacts, to be confirmed by the show committee';

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

  // The Getting-there items, in page order; an item with no body or list is not drawn.
  const gettingThereItems = [
    { heading: 'Parking', body: info?.parking, status: status.parking },
    { heading: 'Public transport', body: info?.publicTransport, status: status.publicTransport },
    {
      heading: 'Where to stay',
      body: info?.accommodationIntro,
      status: status.accommodation,
      children: <AccommodationList options={info?.accommodation} />,
    },
  ].filter((item) => item.body || (item.children && (info?.accommodation ?? []).length > 0));

  return (
    <>
      <NosHero
        route="/national-show/plan-your-visit"
        title={info?.planTitle ?? 'Plan your visit'}
        lede={info?.planIntro ?? undefined}
        priority
      />

      <NosSection wrapClassName="space-y-12">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <section className="space-y-8">
            <SectionHeading
              as="h2"
              title="Getting there"
              lede={gettingThereLede(info?.gettingThereIntro, gettingThereItems)}
            />
            <TravelRoutes routes={info?.airportRoutes} />
            <VisitGettingThere
              items={gettingThereItems}
              pendingLabel={pendingLabel}
              researchLabel={researchLabel}
            />
          </section>

          <aside>
            <VenueCard
              venue={show?.venue}
              status={status.venue}
              pendingLabel={pendingLabel}
              researchLabel={researchLabel}
              mapAction="button"
            />
          </aside>
        </div>

        <VisitAttractions
          title="While you are here"
          attractions={attractions}
          status={status.attractions}
          pendingLabel={pendingLabel}
          researchLabel={researchLabel}
        />
      </NosSection>

      <VisitEmergency
        title="In an emergency"
        label={EMERGENCY_LABEL}
        contacts={info?.emergencyContacts ?? []}
        status={status.emergencyContacts}
        pendingLabel={pendingLabel}
        researchLabel={researchLabel}
      />

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
      <NosShowIndex current="/national-show/plan-your-visit" />
    </>
  );
}
