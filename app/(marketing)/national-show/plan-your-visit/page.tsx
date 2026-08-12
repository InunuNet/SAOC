import type { Metadata } from 'next';
import Link from 'next/link';

import { PageHero } from '@/components/ui/PageHero';
import {
  AccommodationList,
  ConfirmationBadge,
  ShowSectionNav,
  TravelRoutes,
  VenueCard,
  VisitorInfoBlock,
} from '@/components/show';
import { sanityFetch } from '@/sanity/lib/fetch';
import { nationalShowVenueQuery, showVisitorInfoQuery } from '@/sanity/queries';
import type { ShowVenue, ShowVisitorInfo } from '@/types';

// Bound CDN staleness to 60s, matching every other CMS-backed route on the site.
export const revalidate = 60;

export const metadata: Metadata = {
  title: 'Plan Your Visit — National Orchid Show',
  description:
    'Getting to the South African National Orchid Show: travel from the airports, parking, ' +
    'public transport, where to stay and what else to see while you are in town.',
};

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
      <PageHero
        image="/images/orchid-violet.jpg"
        eyebrow="National Show"
        heading={info?.planTitle ?? 'Plan your visit'}
        lede={info?.planIntro ?? undefined}
      />

      <div className="mx-auto max-w-[1280px] space-y-12 px-8 py-16">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <div className="space-y-10">
            <section>
              <h2 className="font-serif text-[clamp(26px,3vw,36px)] font-medium text-ink">
                Getting there
              </h2>
              {info?.gettingThereIntro ? (
                <p className="mt-4 max-w-3xl font-sans text-[16px] leading-relaxed text-ink/80">
                  {info.gettingThereIntro}
                </p>
              ) : null}
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
            <h3 className="font-serif text-[24px] font-medium text-ink">While you are here</h3>
            <ConfirmationBadge
              status={status.attractions}
              pendingLabel={pendingLabel}
              researchLabel={researchLabel}
            />
            <ul className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {attractions.map((attraction, index) => (
                <li
                  key={attraction._key ?? `${attraction.name}-${index}`}
                  className="border border-rule bg-parchment p-5"
                >
                  <p className="font-serif text-[18px] font-medium text-ink">{attraction.name}</p>
                  {attraction.note ? (
                    <p className="mt-2 font-sans text-[14px] leading-relaxed text-ink/70">
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
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {emergencyContacts.length > 0 ? (
          <section className="border-t border-rule pt-8">
            <h3 className="font-serif text-[24px] font-medium text-ink">In an emergency</h3>
            <ConfirmationBadge
              status={status.emergencyContacts}
              pendingLabel={pendingLabel}
              researchLabel={researchLabel}
            />
            <dl className="mt-4 grid grid-cols-1 gap-px bg-rule sm:grid-cols-2 lg:grid-cols-4">
              {emergencyContacts.map((contact, index) => (
                <div key={contact._key ?? `${contact.label}-${index}`} className="bg-parchment p-5">
                  <dt className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted">
                    {contact.label}
                  </dt>
                  <dd className="mt-1 font-serif text-[22px] text-ink">{contact.number}</dd>
                  {contact.note ? (
                    <p className="mt-2 font-sans text-[13px] leading-snug text-ink/60">
                      {contact.note}
                    </p>
                  ) : null}
                </div>
              ))}
            </dl>
          </section>
        ) : null}

        <p className="border-t border-rule pt-8 font-sans text-[16px] text-ink/70">
          Something here not answered?{' '}
          <Link href="/contact" className="underline underline-offset-2 hover:text-accent">
            Ask the council
          </Link>{' '}
          and we will add it.
        </p>
      </div>

      <ShowSectionNav current="/national-show/plan-your-visit" />
    </>
  );
}
