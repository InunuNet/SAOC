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

export const metadata: Metadata = {
  openGraph: { url: 'https://saoc.co.za' },
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
