import {
  Hero,
  MissionBlock,
  NavCards,
  ShowBand,
  EventsStrip,
  YearbookStrip,
  PartnersSection,
} from '@/components/home';
import { sanityFetch } from '@/sanity/lib/fetch';
import { homePageQuery } from '@/sanity/queries';

export default async function HomePage() {
  // A6: wire async data fetch + graceful null fallback.
  // Component prop wiring (passing homeData into Hero/MissionBlock) deferred to a later
  // feature where the components are refactored to accept CMS data. For now we ensure
  // the page shell is async + Sanity-aware so revalidateTag('sanity') / draftMode work.
  await sanityFetch({
    query: homePageQuery,
    tags: ['homePage', 'sanity'],
  });

  return (
    <>
      <Hero />
      <MissionBlock />
      <NavCards />
      <ShowBand />
      <EventsStrip />
      <YearbookStrip />
      <PartnersSection />
    </>
  );
}
