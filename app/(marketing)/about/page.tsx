import type { Metadata } from 'next';
import { PortableText } from '@portabletext/react';
import type { PortableTextBlock } from '@portabletext/react';

import { PageHero } from '@/components/ui/PageHero';
import { BoardGrid } from '@/components/about';
import type { SanityBoardMember } from '@/components/about';
import { sanityFetch } from '@/sanity/lib/fetch';
import { aboutPageQuery, boardMembersQuery } from '@/sanity/queries';
import { boardMembers as staticBoard } from '@/lib/data/board';

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
}

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
        }))
      : staticBoard.map((m, i) => ({
          _id: `static-${i}`,
          name: m.name,
          role: m.role,
          email: null,
          order: i,
        }));

  return (
    <>
      <PageHero
        image="/images/orchid-dark.jpg"
        eyebrow="Since 1968"
        heading="About the South African Orchid Council"
        lede="Coordinating orchid societies across South Africa — growing, showing, hybridising, judging, and community."
      />

      <div className="mx-auto max-w-[1280px] px-8 py-16 space-y-16">
        {/* Pillars */}
        <section>
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted mb-6">
            Our mission
          </p>
          {about?.pillars ? (
            <div className="max-w-none">
              <PortableText value={about.pillars} />
            </div>
          ) : (
            <p className="font-serif text-[20px] leading-relaxed text-ink max-w-3xl">
              SAOC has coordinated orchid cultivation across South Africa since 1968 —
              uniting affiliated societies in growing, showing, hybridising, and judging.
            </p>
          )}
        </section>

        {/* Timeline */}
        <section>
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted mb-6">
            Our history
          </p>
          {about?.timelineNodes ? (
            <div className="max-w-none">
              <PortableText value={about.timelineNodes} />
            </div>
          ) : (
            <p className="font-sans text-[16px] leading-relaxed text-ink/80 max-w-3xl">
              Founded in 1968, the Council has grown to coordinate orchid societies nationwide.
            </p>
          )}
        </section>

        {/* Board */}
        <section>
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted mb-6">
            Our committee
          </p>
          {about?.boardIntroText ? (
            <p className="font-sans text-[16px] leading-relaxed text-ink/80 max-w-3xl mb-8">
              {about.boardIntroText}
            </p>
          ) : null}
          <BoardGrid members={boardForGrid} />
        </section>

        {/* WOSA partnership note — static, no schema field */}
        <section className="border-t border-rule pt-10">
          <p className="font-sans text-[15px] leading-relaxed text-ink/70 max-w-3xl">
            SAOC focuses on orchids in cultivation. For wild orchid identification, habitat,
            and conservation, visit our partner organisation{' '}
            <a
              href="https://wosa.co.za"
              target="_blank"
              rel="noopener noreferrer"
              className="text-ink underline underline-offset-2"
            >
              Wild Orchids of Southern Africa (WOSA)
            </a>
            .
          </p>
        </section>
      </div>
    </>
  );
}
