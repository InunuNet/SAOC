import type { Metadata } from 'next';
import { PortableText } from '@portabletext/react';
import type { PortableTextBlock } from '@portabletext/react';

import { PageHero } from '@/components/ui/PageHero';
import { AwardsGrid, JudgesDirectory } from '@/components/judging';
import type { SanityJudge } from '@/components/judging';
import { sanityFetch } from '@/sanity/lib/fetch';
import { judgingPageQuery } from '@/sanity/queries';

export const metadata: Metadata = { title: 'Judging' };

interface StatItem {
  label: string;
  value: string;
}

interface JudgingPageData {
  title?: string | null;
  intro?: PortableTextBlock[] | null;
  howItWorks?: PortableTextBlock[] | null;
  stats?: StatItem[] | null;
  becomingAJudge?: PortableTextBlock[] | null;
  showPublicDirectory?: boolean | null;
  judges?: SanityJudge[] | null;
}

export default async function JudgingPage() {
  const data = await sanityFetch<JudgingPageData>({
    query: judgingPageQuery,
    tags: ['judging', 'sanity'],
  });

  const judges: SanityJudge[] = data?.judges ?? [];
  const showDirectory = data?.showPublicDirectory === true;

  return (
    <>
      <PageHero
        image="/images/orchid-purple.jpg"
        eyebrow="SAOC judging system"
        heading={data?.title ?? 'Judging at SAOC'}
        lede="Accreditation, awards, and how plants are scored across South Africa."
      />

      <div className="mx-auto max-w-[1280px] px-8 py-16 space-y-16">
        {/* Intro */}
        <section>
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted mb-6">
            Overview
          </p>
          {data?.intro ? (
            <div className="max-w-none">
              <PortableText value={data.intro} />
            </div>
          ) : (
            <p className="font-serif text-[20px] leading-relaxed text-ink max-w-3xl">
              SAOC operates a national orchid judging system — training and accrediting judges who
              score plants on form, colour, size, and cultural condition at affiliated shows.
            </p>
          )}
        </section>

        {/* How it works */}
        <section>
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted mb-6">
            How judging works
          </p>
          {data?.howItWorks ? (
            <div className="max-w-none">
              <PortableText value={data.howItWorks} />
            </div>
          ) : (
            <p className="font-sans text-[16px] leading-relaxed text-ink/80 max-w-3xl">
              Plants are assessed by accredited judging panels against published criteria. Awards
              are conferred when a plant meets the required point threshold.
            </p>
          )}
        </section>

        {/* Stats strip — render only when present */}
        {data?.stats && data.stats.length > 0 ? (
          <section className="grid grid-cols-2 gap-8 border-y border-rule py-10 sm:grid-cols-4">
            {data.stats.map((stat, i) => (
              <div key={`${stat.label}-${i}`}>
                <p className="font-serif text-[32px] font-medium text-ink">{stat.value}</p>
                <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.16em] text-muted">
                  {stat.label}
                </p>
              </div>
            ))}
          </section>
        ) : null}

        {/* Awards grid — always static */}
        <section>
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted mb-6">
            SAOC awards
          </p>
          <AwardsGrid />
        </section>

        {/* Becoming a judge */}
        <section>
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted mb-6">
            Becoming a judge
          </p>
          {data?.becomingAJudge ? (
            <div className="max-w-none">
              <PortableText value={data.becomingAJudge} />
            </div>
          ) : (
            <p className="font-sans text-[16px] leading-relaxed text-ink/80 max-w-3xl">
              Judging accreditation is earned through a structured training programme run by SAOC.
              Speak to your affiliated society to begin the pathway.
            </p>
          )}
        </section>

        {/* Judges directory — conditional */}
        <section>
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted mb-6">
            Accredited judges
          </p>
          <JudgesDirectory judges={judges} showPublicDirectory={showDirectory} />
        </section>
      </div>
    </>
  );
}
