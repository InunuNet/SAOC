import type { Metadata } from 'next';
import type { SanityImageSource } from '@sanity/image-url';

import {
  Hero,
  MissionBlock,
  NavCards,
  ShowBand,
  EventsStrip,
  YearbookStrip,
  PartnersSection,
} from '@/components/home';
import { JsonLd, organizationJsonLd } from '@/components/seo/JsonLd';
import { sanityFetch } from '@/sanity/lib/fetch';
import {
  homePageQuery,
  upcomingEventsQuery,
  partnersQuery,
  nationalShowQuery,
} from '@/sanity/queries';
import type { SanityEvent } from '@/components/home/EventsStrip';
import type { SanityPartner } from '@/components/home/PartnersSection';

interface HomePageData {
  title?: string;
  heroImages?: SanityImageSource[] | null;
  missionText?: string | null;
  countdownDate?: string | null;
}

interface NationalShowData {
  countdownDate?: string | null;
}

const BASE_URL = 'https://saoc.co.za';

// F1 cms-loop: bound CDN staleness to 60s (no programmatic purge API exists for
// Firebase App Hosting — see docs/f1-cdn-purge-api-findings.md) so a Sanity publish
// propagates within F6's 120s round-trip window. See contracts/cms-loop-f1-cdn-purge.yaml.
export const revalidate = 60;

export const metadata: Metadata = {
  title: 'South African Orchid Council',
  description:
    'The South African Orchid Council — coordinating orchid societies across South Africa since 1968.',
  openGraph: {
    url: BASE_URL,
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

export default async function HomePage() {
  const [home, eventsData, partnersData, show] = await Promise.all([
    sanityFetch<HomePageData>({ query: homePageQuery, tags: ['homePage', 'sanity'] }),
    sanityFetch<SanityEvent[]>({ query: upcomingEventsQuery, tags: ['societyEvent', 'sanity'] }),
    sanityFetch<SanityPartner[]>({ query: partnersQuery, tags: ['sponsor', 'sanity'] }),
    sanityFetch<NationalShowData>({ query: nationalShowQuery, tags: ['nationalShow', 'sanity'] }),
  ]);

  return (
    <>
      <JsonLd data={organizationJsonLd()} />
      <Hero images={home?.heroImages} />
      <MissionBlock missionText={home?.missionText} />
      <NavCards />
      <ShowBand countdownDate={show?.countdownDate} />
      <EventsStrip events={eventsData} />
      <YearbookStrip />
      <PartnersSection partners={partnersData} />
    </>
  );
}
