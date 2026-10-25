import type { Metadata } from 'next';

import { LongFormPage } from '@/components/nos/LongFormPage';
import { NosHero } from '@/components/nos/NosHero';
import { NosSection } from '@/components/nos/NosSection';
import { loadShowFacts } from '@/lib/data/show-facts';
import { SHOW_TITLE, SHOW_TITLE_SUB } from '@/lib/show-title';
import { buildPageMetadata } from '@/lib/seo';
import { nosOgImage } from '@/app/(nos)/national-show/og-image';
import { NosShowIndex } from '@/components/nos/NosShowIndex';

// The seven paragraphs are Lee-Ann's About text of 24 Oct 2026, published as she wrote them (straight
// quotes and hyphens included). Do not paraphrase or tighten this copy: docs/rules/no-invention.md.
// Bound CDN staleness to 60s, matching every other CMS-backed route on the site (the facts read Sanity).
export const revalidate = 60;

export const metadata: Metadata = buildPageMetadata({
  title: 'About the Show',
  description:
    "The National Orchid Show - Western Cape 2027 is the South African Orchid Council's premier " +
    'triennial event.',
  path: '/national-show/about',
  image: nosOgImage('About the National Show'),
});

export default async function NationalShowAboutPage() {
  const facts = await loadShowFacts();

  return (
    <>
      <NosHero
        route="/national-show/about"
        title={
          <>
            {SHOW_TITLE}
            <span className="sr-only"> - </span>
            <span style={{ fontSize: '0.5em', fontWeight: 300 }}>{SHOW_TITLE_SUB}</span>
          </>
        }
        priority
      />

      <NosSection>
        <LongFormPage
          facts={facts}
          pullQuote="From Wild Origins to Cultivated Excellence: The Future of Orchids"
          paragraphs={[
            "The National Orchid Show - Western Cape 2027 is the South African Orchid Council's premier triennial event, bringing together orchid enthusiasts, growers, researchers, conservationists, judges, horticultural professionals and members of the public to celebrate one of the world's most remarkable plant families.",
            "Guided by the theme \"From Wild Origins to Cultivated Excellence: The Future of Orchids,\" the National Show explores the relationship between orchids in their natural habitats and the future of responsible cultivation. As pressures on natural ecosystems continue to increase, understanding how orchids grow, adapt and interact within their environments has never been more important. The knowledge gained through conservation and scientific research provides the foundation for sustainable cultivation, ethical breeding programmes and the long-term future of orchid growing worldwide.",
            "The National Orchid Show will showcase a spectacular display of all the orchids that are submitted for judging and display. There will be specialist plant sales by local and international vendors, educational exhibits, a comprehensive symposium and conference, practical workshops and opportunities to engage with local and international experts.",
            "An important feature of the 2027 programme will be the participation of Wild Orchids of Southern Africa (WOSA). They will hold their annual conference as part of the National Orchid Show. Their involvement reflects the National Orchid Show's commitment to connecting conservation science with horticultural excellence, demonstrating how knowledge gained from orchids in the wild continues to shape responsible cultivation and the future sustainability of the orchid community.",
            "The exhibition will also welcome leading national and international orchid vendors, giving visitors the opportunity to purchase exceptional plants, discover new hybrids and species, and engage directly with some of the world's most respected growers.",
            "The South African Orchid Council is deeply grateful to its headline sponsors and donors, whose generous support has made it possible to present a National Show of this scale and significance.",
            "Whether you are an experienced orchid grower, a passionate gardener, a researcher, or simply discovering orchids for the first time, the National Orchid Show - Western Cape 2027 offers an inspiring opportunity to experience the extraordinary beauty, diversity and future potential of orchids.",
          ]}
        />
      </NosSection>
      <NosShowIndex current="/national-show/about" />
    </>
  );
}
