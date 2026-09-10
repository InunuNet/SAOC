import type { Metadata } from 'next';

import { PageHero } from '@/components/ui/PageHero';
import { ShowSectionNav } from '@/components/show';

// Content sourced verbatim from docs/leeann-source/about-national-show_2026-09-09.md
// (Drive: "2.1 About - 2027 National Show.docx", snapshot 2026-09-09). Do not paraphrase
// or tighten this copy — see docs/rules/no-invention.md and the f3-canary-phrases.json
// golden this route is checked against.
export const metadata: Metadata = {
  title: 'About the National Show',
  description:
    "The 2027 South African National Orchid Show is the South African Orchid Council's " +
    'premier triennial event.',
};

export default function NationalShowAboutPage() {
  return (
    <>
      <PageHero
        image="/images/orchid-purple.jpg"
        eyebrow="National Show"
        heading="2027 South African National Orchid Show"
      />

      <div className="mx-auto max-w-[900px] space-y-6 px-8 py-16">
        <p className="font-sans text-[16px] leading-relaxed text-ink/80">
          The 2027 South African National Orchid Show is the South African Orchid
          Council&rsquo;s premier triennial event, bringing together orchid enthusiasts,
          growers, researchers, conservationists, judges, horticultural professionals and
          members of the public to celebrate one of the world&rsquo;s most remarkable plant
          families.
        </p>

        <p className="font-sans text-[16px] leading-relaxed text-ink/80">
          Guided by the theme &ldquo;From Wild Origins to Cultivated Excellence: The Future of
          Orchids,&rdquo; the National Show explores the relationship between orchids in their
          natural habitats and the future of responsible cultivation. As pressures on natural
          ecosystems continue to increase, understanding how orchids grow, adapt and interact
          within their environments has never been more important. The knowledge gained
          through conservation and scientific research provides the foundation for
          sustainable cultivation, ethical breeding programmes and the long-term future of
          orchid growing worldwide.
        </p>

        <p className="font-sans text-[16px] leading-relaxed text-ink/80">
          The National Show will showcase spectacular displays created by orchid societies and
          specialist growers from across South Africa, alongside the country&rsquo;s highest
          level of orchid judging and awards, specialist plant sales, educational exhibits, a
          comprehensive symposium, practical workshops and opportunities to engage with local
          and international experts.
        </p>

        <p className="font-sans text-[16px] leading-relaxed text-ink/80">
          An important feature of the 2027 programme will be the participation of Wild Orchids
          of Southern Africa (WOSA). Through presentations and collaborative sessions within the symposium,
          WOSA will contribute valuable insights into the ecology, conservation and study of indigenous orchids.
          Their involvement reflects the National Show&rsquo;s commitment to connecting conservation science with
          horticultural excellence, demonstrating how knowledge gained from orchids in the wild continues to
          shape responsible cultivation and the future sustainability of the orchid community.
        </p>

        {/* WOSA is credited as a hosted guest presenting within the symposium, per
            CLAUDE.md's scope boundary and docs/rules/no-invention.md — SAOC attributes and
            links out, it never authors conservation content in its own voice. */}
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
          The exhibition will also welcome leading national and international orchid vendors,
          giving visitors the opportunity to purchase exceptional plants, discover new hybrids
          and species, and engage directly with some of the world&rsquo;s most respected
          growers. The South African Orchid Council is deeply grateful to its headline
          sponsors and donors, whose generous support has made it possible to present a
          National Show of this scale and significance.
        </p>

        <p className="font-sans text-[16px] leading-relaxed text-ink/80">
          Whether you are an experienced orchid grower, a passionate gardener, a researcher,
          or simply discovering orchids for the first time, the 2027 National Show offers an
          inspiring opportunity to experience the extraordinary beauty, diversity and future
          potential of orchids.
        </p>
      </div>

      <ShowSectionNav current="/national-show/about" />
    </>
  );
}
