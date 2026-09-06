import type { Metadata } from 'next';
import { PortableText } from '@portabletext/react';
import type { PortableTextBlock } from '@portabletext/react';

import { PageHero } from '@/components/ui/PageHero';
import { PhotoBand } from '@/components/ui/PhotoBand';
import { CTASection } from '@/components/ui/CTASection';
import { AwardsGrid, JudgesDirectory } from '@/components/judging';
import type { SanityAward, SanityJudge } from '@/components/judging';
import { sanityFetch } from '@/sanity/lib/fetch';
import { awardsQuery, judgingPageQuery } from '@/sanity/queries';

// F1 cms-loop: bound CDN staleness to 60s (no programmatic purge API exists for
// Firebase App Hosting — see docs/f1-cdn-purge-api-findings.md) so a Sanity publish
// propagates within F6's 120s round-trip window. See contracts/cms-loop-f1-cdn-purge.yaml.
export const revalidate = 60;

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

// Fallback figures — the same real 56/1990/21 already used on Home, plus the award-tier
// count derived from the awards actually returned rather than hardcoded.
function buildFallbackStats(awardCount: number): StatItem[] {
  return [
    { value: '56', label: 'Accredited Judges' },
    { value: '1990', label: 'System Standardised' },
    { value: '21', label: 'Affiliated Societies' },
    { value: String(awardCount || 6), label: 'Award Tiers' },
  ];
}

export default async function JudgingPage() {
  const [data, awards] = await Promise.all([
    sanityFetch<JudgingPageData>({
      query: judgingPageQuery,
      tags: ['judging', 'sanity'],
    }),
    sanityFetch<SanityAward[]>({
      query: awardsQuery,
      tags: ['judging', 'sanity', 'award'],
    }),
  ]);

  const judges: SanityJudge[] = data?.judges ?? [];
  const showDirectory = data?.showPublicDirectory === true;
  const awardsList = awards ?? [];
  const stats = data?.stats && data.stats.length > 0 ? data.stats : buildFallbackStats(awardsList.length);

  return (
    <>
      <PageHero
        image="/images/orchid-purple.jpg"
        eyebrow="SAOC judging system"
        heading={data?.title ?? 'Judging at SAOC'}
        lede="Accreditation, awards, and how plants are scored across South Africa."
      />

      {/* Intro */}
      <section className="bg-parchment px-8 py-24 md:px-16">
        <div className="mx-auto max-w-[1280px]">
          <div className="mb-3">
            <span className="eyebrow">Overview</span>
          </div>
          {data?.intro && data.intro.length > 0 ? (
            <div className="max-w-3xl">
              <PortableText value={data.intro} />
            </div>
          ) : (
            <p className="max-w-3xl font-serif text-[20px] leading-relaxed text-ink">
              SAOC operates a national orchid judging system, standardised in 1990 to replace
              regional variation with a single set of published criteria. Accredited judges
              score plants on form, colour, size, and cultural condition at affiliated shows
              across the country, and the same criteria decide every award from a first
              Highly Commended Certificate through to a Certificate of Cultural Merit.
            </p>
          )}
        </div>
      </section>

      {/* Stats strip — always renders: Sanity content when present, real figures otherwise */}
      <section className="bg-bone px-8 py-16 md:px-16">
        <dl className="mx-auto grid max-w-[1280px] grid-cols-2 gap-x-8 gap-y-8 border-y border-rule py-10 sm:grid-cols-4">
          {stats.map((stat, i) => (
            <div key={`${stat.label}-${i}`}>
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

      {/* How it works */}
      <section className="bg-parchment px-8 py-24 md:px-16">
        <div className="mx-auto max-w-[1280px]">
          <div className="mb-6">
            <span className="eyebrow">How judging works</span>
          </div>
          {data?.howItWorks && data.howItWorks.length > 0 ? (
            <div className="max-w-3xl">
              <PortableText value={data.howItWorks} />
            </div>
          ) : (
            <p className="max-w-3xl font-sans text-[16px] leading-relaxed text-ink/80">
              Plants are assessed by panels of accredited judges against published criteria for
              form, colour, size, and cultural condition.{' '}
              <span data-placeholder="true">
                Panels typically comprise three judges
              </span>{' '}
              and convene at affiliated society shows throughout the year, as well as at the
              triennial National Show, where awards are conferred once a plant meets the
              required point threshold for its class.
            </p>
          )}
        </div>
      </section>

      <PhotoBand
        image="/images/orchid-dark.jpg"
        alt="Dark orchid on the show bench"
        caption="Form, colour, size, condition — judged against published criteria"
        minHeight="320px"
      />

      {/* Awards grid */}
      <section className="bg-bone px-8 py-24 md:px-16">
        <div className="mx-auto max-w-[1280px]">
          <div className="mb-10">
            <span className="eyebrow">SAOC awards</span>
          </div>
          <AwardsGrid awards={awardsList} />
        </div>
      </section>

      {/* Becoming a judge */}
      <section className="bg-parchment px-8 py-24 md:px-16">
        <div className="mx-auto max-w-[1280px]">
          <div className="mb-6">
            <span className="eyebrow">Becoming a judge</span>
          </div>
          {data?.becomingAJudge && data.becomingAJudge.length > 0 ? (
            <div className="max-w-3xl">
              <PortableText value={data.becomingAJudge} />
            </div>
          ) : (
            <p className="max-w-3xl font-sans text-[16px] leading-relaxed text-ink/80">
              Judging accreditation is earned through a structured training programme run by
              SAOC.{' '}
              <span data-placeholder="true">
                Candidates begin as student judges, attend regional training sessions, and sit
                a probationary period observing panels before accreditation is confirmed
              </span>
              . Speak to your affiliated society to begin the pathway.
            </p>
          )}
        </div>
      </section>

      {/* Judges directory — conditional */}
      <section className="bg-bone px-8 py-16 md:px-16">
        <div className="mx-auto max-w-[1280px]">
          <div className="mb-6">
            <span className="eyebrow">Accredited judges</span>
          </div>
          <JudgesDirectory judges={judges} showPublicDirectory={showDirectory} />
        </div>
      </section>

      <CTASection
        eyebrow="Get involved"
        heading="See judging in action"
        body="Judging happens at every affiliated show. Visit an upcoming show to watch panels at work, or start the path toward accreditation through your society."
        primaryCta={{ href: '/events', label: 'Find a show' }}
        secondaryCta={{ href: '/societies', label: 'Find your society' }}
      />
    </>
  );
}
