import type { Metadata } from 'next';
import type { SanityImageSource } from '@sanity/image-url';

import {
  Hero,
  MissionBlock,
  ForewordSection,
  NavCards,
  ShowBand,
  EventsStrip,
  YearbookStrip,
  PartnersSection,
} from '@/components/home';
import { JsonLd, organizationJsonLd } from '@/components/seo/JsonLd';
import { saocOrigin } from '@/lib/site-hosts';
import { upcomingEventsParams } from '@/lib/sast-date';
import { withholdPlaceholderProse } from '@/lib/data/show-pages';
import { societies as staticSocieties } from '@/lib/data/societies';
import { client } from '@/sanity/lib/client';
import { sanityFetch } from '@/sanity/lib/fetch';
import {
  homePageQuery,
  upcomingEventsQuery,
  partnersQuery,
  nationalShowQuery,
  societyListQuery,
} from '@/sanity/queries';
import type { SanityEvent } from '@/components/home/EventsStrip';
import type { SanityPartner } from '@/components/home/PartnersSection';
import type { ShowIdentity } from '@/types';
import type { SanitySociety } from '@/components/societies';

interface HomePageData {
  title?: string;
  heroImages?: SanityImageSource[] | null;
  missionText?: string | null;
}

// F1 cms-loop: bound CDN staleness to 60s (no programmatic purge API exists for
// Firebase App Hosting — see docs/f1-cdn-purge-api-findings.md) so a Sanity publish
// propagates within F6's 120s round-trip window. See contracts/cms-loop-f1-cdn-purge.yaml.
export const revalidate = 60;

export function generateMetadata(): Metadata {
  return {
    title: { absolute: 'South African Orchid Council' },
    description:
      'The South African Orchid Council — coordinating orchid societies across South Africa since 1968.',
    openGraph: {
      siteName: 'South African Orchid Council',
      url: saocOrigin(),
      title: 'South African Orchid Council',
      description:
        'The South African Orchid Council — coordinating orchid societies across South Africa since 1968.',
      images: [
        {
          url: `/og?title=${encodeURIComponent('South African Orchid Council')}`,
          width: 1200,
          height: 630,
          alt: 'South African Orchid Council',
        },
      ],
    },
    twitter: { card: 'summary_large_image' },
  };
}

export default async function HomePage() {
  const [home, eventsData, partnersData, show, listedSocieties] = await Promise.all([
    sanityFetch<HomePageData>({ query: homePageQuery, tags: ['homePage', 'sanity'] }),
    sanityFetch<SanityEvent[]>({ query: upcomingEventsQuery, params: upcomingEventsParams(), tags: ['societyEvent', 'sanity'] }),
    sanityFetch<SanityPartner[]>({ query: partnersQuery, tags: ['sponsor', 'sanity'] }),
    sanityFetch<ShowIdentity>({ query: nationalShowQuery, tags: ['nationalShow', 'sanity'] }),
    sanityFetch<SanitySociety[]>({ query: societyListQuery, tags: ['society', 'sanity'] }),
  ]);

  // F19 (vote 1C): facts the Council has not supplied render on the beta preview only, marked.
  const withhold = withholdPlaceholderProse();
  // Match the /societies page: use its listed Sanity records, or its static fallback only offline.
  const societyCount = listedSocieties && listedSocieties.length > 0
    ? listedSocieties.length
    : client === null ? staticSocieties.length : listedSocieties?.length ?? null;

  return (
    <>
      <JsonLd data={organizationJsonLd()} />
      <Hero images={home?.heroImages} show={show} societyCount={societyCount} />
      <MissionBlock missionText={home?.missionText} withhold={withhold} />
      <NavCards show={show} withhold={withhold} />
      <ForewordSection />
      <ShowBand show={show} />
      <EventsStrip events={eventsData} />
      {withhold ? null : <YearbookStrip />}
      <PartnersSection partners={partnersData} />
    </>
  );
}
