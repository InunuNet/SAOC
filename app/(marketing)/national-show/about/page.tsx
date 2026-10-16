import type { Metadata } from 'next';

import { LongFormPage } from '@/components/nos/LongFormPage';
import { NosHero } from '@/components/nos/NosHero';
import { NosSection } from '@/components/nos/NosSection';
import { loadShowFacts } from '@/lib/data/show-facts';
import { buildPageMetadata } from '@/lib/seo';
import { nosOgImage } from '@/app/(marketing)/national-show/og-image';
import { NosShowIndex } from '@/components/nos/NosShowIndex';

// Content sourced verbatim from docs/leeann-source/about-national-show_2026-09-09.md
// (Drive: "2.1 About - 2027 National Show.docx", snapshot 2026-09-09). Do not paraphrase
// or tighten this copy — see docs/rules/no-invention.md and the f3-canary-phrases.json
// golden this route is checked against.
// Bound CDN staleness to 60s, matching every other CMS-backed route on the site (the facts read Sanity).
export const revalidate = 60;

export const metadata: Metadata = buildPageMetadata({
  title: 'About the National Show',
  description:
    "The 2027 South African National Orchid Show is the South African Orchid Council's " +
    'premier triennial event.',
  path: '/national-show/about',
  image: nosOgImage('About the National Show'),
});

export default async function NationalShowAboutPage() {
  const facts = await loadShowFacts();

  return (
    <>
      <NosHero
        route="/national-show/about"
        title="2027 South African National Orchid Show"
        priority
      />

      <NosSection>
        <LongFormPage
          facts={facts}
          pullQuote="From Wild Origins to Cultivated Excellence: The Future of Orchids"
          paragraphs={[
            <>
              The 2027 South African National Orchid Show is the South African Orchid
              Council&rsquo;s premier triennial event, bringing together orchid enthusiasts,
              growers, researchers, conservationists, judges, horticultural professionals and
              members of the public to celebrate one of the world&rsquo;s most remarkable plant
              families.
            </>,
            <>
              Guided by the theme &ldquo;From Wild Origins to Cultivated Excellence: The Future of
              Orchids,&rdquo; the National Show explores the relationship between orchids in their
              natural habitats and the future of responsible cultivation. As pressures on natural
              ecosystems continue to increase, understanding how orchids grow, adapt and interact
              within their environments has never been more important. The knowledge gained through
              conservation and scientific research provides the foundation for sustainable
              cultivation, ethical breeding programmes and the long-term future of orchid growing
              worldwide.
            </>,
            <>
              The National Show will showcase spectacular displays created by orchid societies and
              specialist growers from across South Africa, alongside the country&rsquo;s highest
              level of orchid judging and awards, specialist plant sales, educational exhibits, a
              comprehensive symposium, practical workshops and opportunities to engage with local
              and international experts.
            </>,
            <>
              An important feature of the 2027 programme will be the participation of Wild Orchids
              of Southern Africa (WOSA). Through presentations and collaborative sessions within the
              symposium, WOSA will contribute valuable insights into the ecology, conservation and
              study of indigenous orchids. Their involvement reflects the National Show&rsquo;s
              commitment to connecting conservation science with horticultural excellence,
              demonstrating how knowledge gained from orchids in the wild continues to shape
              responsible cultivation and the future sustainability of the orchid community.
            </>,
            <>
              The exhibition will also welcome leading national and international orchid vendors,
              giving visitors the opportunity to purchase exceptional plants, discover new hybrids
              and species, and engage directly with some of the world&rsquo;s most respected
              growers. The South African Orchid Council is deeply grateful to its headline sponsors
              and donors, whose generous support has made it possible to present a National Show of
              this scale and significance.
            </>,
            <>
              Whether you are an experienced orchid grower, a passionate gardener, a researcher, or
              simply discovering orchids for the first time, the 2027 National Show offers an
              inspiring opportunity to experience the extraordinary beauty, diversity and future
              potential of orchids.
            </>,
          ]}
        />
      </NosSection>
      <NosShowIndex current="/national-show/about" />
    </>
  );
}
