import type { Metadata } from 'next';
import { PortableText } from '@portabletext/react';
import type { PortableTextBlock } from '@portabletext/react';

import { PageHero } from '@/components/ui/PageHero';
import { PhotoBand } from '@/components/ui/PhotoBand';
import { CTASection } from '@/components/ui/CTASection';
import { BoardGrid, Timeline } from '@/components/about';
import type { SanityBoardMember, TimelineNode } from '@/components/about';
import { sanityFetch } from '@/sanity/lib/fetch';
import { aboutPageQuery, boardMembersQuery } from '@/sanity/queries';
import { boardMembers as staticBoard } from '@/lib/data/board';

// F1 cms-loop: bound CDN staleness to 60s (no programmatic purge API exists for
// Firebase App Hosting — see docs/f1-cdn-purge-api-findings.md) so a Sanity publish
// propagates within F6's 120s round-trip window. See contracts/cms-loop-f1-cdn-purge.yaml.
export const revalidate = 60;

export const metadata: Metadata = { title: 'About SAOC' };

interface AboutPageData {
  title?: string | null;
  pillars?: PortableTextBlock[] | null;
  timelineNodes?: PortableTextBlock[] | null;
  boardIntroText?: string | null;
}

interface BoardMemberData {
  _id: string;
  name: string;
  role: string | null;
  email: string | null;
  order: number | null;
  placeholder: boolean | null;
}

// Heritage stats — the same real figures as Home's mission-block stat band,
// reframed around the founding story rather than the "four ways in" story.
const HERITAGE_STATS = [
  { value: '1968', label: 'Council Founded' },
  { value: '1990', label: 'Judging Standardised' },
  { value: '18', label: 'National Shows Hosted' },
  { value: '21', label: 'Affiliated Societies' },
] as const;

// Fallback founding-to-present timeline, rendered when the aboutPage Sanity
// document's `timelineNodes` portable-text field has no content yet. Nodes
// carrying invented (not council-confirmed) detail are marked `placeholder`
// and render with a visible "Detail pending confirmation" badge.
const FALLBACK_TIMELINE: TimelineNode[] = [
  {
    year: '1968',
    heading: 'Four societies form a national council',
    body: 'Delegates from four orchid societies meet in Bloemfontein on 29 July 1968 and agree to form the South African Orchid Council, giving the country’s growers a single federated body.',
  },
  {
    year: '1978',
    heading: 'Incorporated as a non-profit body',
    body: 'SAOC is formally incorporated (Reg. 1978/004040/08), placing the young council on a permanent legal footing as more societies affiliate.',
  },
  {
    year: '1970s–2000s',
    heading: 'Growth to a national federation',
    body: 'Membership expands steadily across all nine provinces as new societies affiliate, from the Cape to Limpopo.',
    placeholder: true,
  },
  {
    year: '1990',
    heading: 'The judging system is standardised',
    body: 'SAOC adopts a single, nationally consistent judging system and accreditation pathway, replacing regional variation with published criteria used at every affiliated show.',
  },
  {
    year: 'Today',
    heading: 'Twenty-one societies, one council',
    body: 'SAOC now coordinates 21 affiliated societies and has hosted 18 national shows, continuing the work its founders began in 1968 — growing, showing, hybridising and judging orchids in cultivation.',
  },
];

export default async function AboutPage() {
  const [about, board] = await Promise.all([
    sanityFetch<AboutPageData>({
      query: aboutPageQuery,
      tags: ['aboutPage', 'sanity'],
    }),
    sanityFetch<BoardMemberData[]>({
      query: boardMembersQuery,
      tags: ['boardMember', 'sanity'],
    }),
  ]);

  const sanityBoard = board ?? [];
  const boardForGrid: SanityBoardMember[] =
    sanityBoard.length > 0
      ? sanityBoard.map((m) => ({
          _id: m._id,
          name: m.name,
          role: m.role,
          email: m.email,
          order: m.order,
          placeholder: m.placeholder ?? false,
        }))
      : staticBoard.map((m, i) => ({
          _id: `static-${i}`,
          name: m.name,
          role: m.role,
          email: null,
          order: i,
          placeholder: true,
        }));

  return (
    <>
      <PageHero
        image="/images/orchid-violet.jpg"
        eyebrow="Our heritage"
        heading={about?.title ?? 'A federated body of growers, since 1968.'}
        lede="Four societies met in Bloemfontein on the 29th of July, 1968 to form a national council. Fifty-eight years later, that council coordinates twenty-one societies from the Cape to the Limpopo."
      />

      {/* Mission */}
      <section className="bg-parchment px-8 py-24 md:px-16">
        <div className="mx-auto max-w-[1280px]">
          <div className="mb-3">
            <span className="eyebrow">Our mission</span>
          </div>
          {about?.pillars && about.pillars.length > 0 ? (
            <div className="max-w-3xl">
              <PortableText value={about.pillars} />
            </div>
          ) : (
            <p className="max-w-3xl font-serif text-[20px] leading-relaxed text-ink">
              SAOC exists to promote the culture, hybridisation and appreciation of orchids in
              cultivation across South Africa — uniting affiliated societies in growing,
              showing, judging, and the community that grows up around a shared bench of plants.
              Our remit stops at the greenhouse door: for indigenous species in the wild, our
              partner organisation Wild Orchids of Southern Africa leads that work.
            </p>
          )}
        </div>
      </section>

      {/* Heritage stats */}
      <section className="bg-bone px-8 py-16 md:px-16">
        <dl className="mx-auto grid max-w-[1280px] grid-cols-2 gap-x-8 gap-y-8 border-y border-rule py-10 sm:grid-cols-4">
          {HERITAGE_STATS.map((stat) => (
            <div key={stat.label}>
              <dt className="font-serif text-[clamp(36px,4vw,56px)] font-medium leading-none text-primary">
                {stat.value}
              </dt>
              <dd className="mt-2 font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
                {stat.label}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <PhotoBand
        image="/images/orchid-pink.jpg"
        alt="Pink orchid in bloom"
        caption="Est. 1968 · Bloemfontein"
        minHeight="320px"
      />

      {/* History / timeline */}
      <section className="bg-parchment px-8 py-24 md:px-16">
        <div className="mx-auto max-w-[1280px]">
          <div className="mb-10">
            <div className="mb-3">
              <span className="eyebrow">Our history</span>
            </div>
            <h2 className="font-serif text-[clamp(30px,3.6vw,44px)] font-medium leading-[1.1] tracking-[-0.01em] text-primary">
              From four societies to a national council
            </h2>
          </div>
          {about?.timelineNodes && about.timelineNodes.length > 0 ? (
            <div className="max-w-3xl">
              <PortableText value={about.timelineNodes} />
            </div>
          ) : (
            <Timeline nodes={FALLBACK_TIMELINE} />
          )}
        </div>
      </section>

      {/* Board */}
      <section className="bg-bone px-8 py-24 md:px-16">
        <div className="mx-auto max-w-[1280px]">
          <div className="mb-10">
            <div className="mb-3">
              <span className="eyebrow">Our committee</span>
            </div>
            <h2 className="font-serif text-[clamp(30px,3.6vw,44px)] font-medium leading-[1.1] tracking-[-0.01em] text-primary">
              The national committee
            </h2>
          </div>
          {about?.boardIntroText ? (
            <p className="mb-8 max-w-3xl font-sans text-[16px] leading-relaxed text-ink/80">
              {about.boardIntroText}
            </p>
          ) : (
            <p className="mb-8 max-w-3xl font-sans text-[16px] leading-relaxed text-ink/80">
              SAOC is run by a national committee elected from its affiliated societies,
              overseeing judging, shows, publications and the council&apos;s day-to-day affairs.
            </p>
          )}
          <BoardGrid members={boardForGrid} />
        </div>
      </section>

      {/* WOSA partnership note — static, no schema field */}
      <section className="bg-parchment px-8 py-16 md:px-16">
        <div className="mx-auto max-w-[1280px] border-t border-rule pt-10">
          <p className="max-w-3xl font-sans text-[15px] leading-relaxed text-ink/70">
            SAOC focuses on orchids in cultivation. For wild orchid identification, habitat,
            and conservation, visit our partner organisation{' '}
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
        </div>
      </section>

      <CTASection
        eyebrow="Get involved"
        heading="Find your society, join the council's work"
        body="SAOC is a federation of 21 independent orchid societies. Find one near you, or get in touch with the national committee directly."
        primaryCta={{ href: '/societies', label: 'Find a society' }}
        secondaryCta={{ href: '/contact', label: 'Contact SAOC' }}
      />
    </>
  );
}
