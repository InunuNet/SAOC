import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import { PortableText } from '@portabletext/react';
import type { PortableTextBlock } from '@portabletext/react';

import { PageHero } from '@/components/ui/PageHero';
import { PhotoBand } from '@/components/ui/PhotoBand';
import { CTASection } from '@/components/ui/CTASection';
import { ContentGap } from '@/components/ui/ContentGap';
import { isUnsourced, sourcedBlocks } from '@/components/ui/provenance';
import { PlaceholderMarker } from '@/components/ui/PlaceholderMarker';
import { AwardsGrid, JudgesDirectory } from '@/components/judging';
import { JudgingSplit } from '@/components/judging/JudgingSplit';
import type { SanityAward, SanityJudge } from '@/components/judging';
import { withholdPlaceholderProse } from '@/lib/data/show-pages';
import { buildPageMetadata } from '@/lib/seo';
import { sanityFetch } from '@/sanity/lib/fetch';
import { awardsQuery, judgingPageQuery } from '@/sanity/queries';

// F1 cms-loop: bound CDN staleness to 60s (no programmatic purge API exists for
// Firebase App Hosting — see docs/f1-cdn-purge-api-findings.md) so a Sanity publish
// propagates within F6's 120s round-trip window. See contracts/cms-loop-f1-cdn-purge.yaml.
export const revalidate = 60;

const LEDE = 'Accreditation, awards, and how plants are scored across South Africa.';

export const metadata: Metadata = buildPageMetadata({
  title: 'Judging at SAOC',
  description: LEDE,
  lede: LEDE,
  path: '/judging',
});

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

const PHOTO_CAPTION = 'Form, colour, size, condition — judged against published criteria';

// Fallback figure: the award-tier count derived from the awards actually returned rather than
// hardcoded. The judge, year and society figures are left out (Lee-Ann, 24 Oct 2026).
function buildFallbackStats(awardCount: number): StatItem[] {
  return [{ value: String(awardCount || 6), label: 'Award Tiers' }];
}

interface ProseSection {
  heading: string;
  tone: 'parchment' | 'bone';
  /** Public: the blocks that state no unsourced fact. Beta: everything, marked. */
  content: ReactNode | null;
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

  // F19 (vote 1C): the 100-point scale, thresholds, criteria, 1990 and the judge count are not in
  // the Council's Drive. The beta preview shows them marked; the public build leaves them out and
  // states the gap once.
  const withhold = withholdPlaceholderProse();
  const judges: SanityJudge[] = data?.judges ?? [];
  const showDirectory = data?.showPublicDirectory === true;
  const awardsList = awards ?? [];
  const allStats =
    data?.stats && data.stats.length > 0 ? data.stats : buildFallbackStats(awardsList.length);
  const stats = withhold
    ? allStats.filter((stat) => !isUnsourced(stat.label) && !isUnsourced(stat.value))
    : allStats;

  const prose = (blocks: PortableTextBlock[] | null | undefined, fallback: ReactNode) => {
    if (blocks && blocks.length > 0) {
      const shown = withhold ? sourcedBlocks(blocks) : blocks;
      return shown ? <PortableText value={shown} /> : null;
    }
    return withhold ? null : fallback;
  };

  const sections: ProseSection[] = [
    {
      heading: 'Overview',
      tone: 'parchment',
      content: prose(
        data?.intro,
        <p className="font-serif font-normal text-[20px] leading-[1.55] text-ink">
          SAOC operates a national orchid judging system, standardised in 1990 to replace
          regional variation with a single set of published criteria. Accredited judges
          score plants on form, colour, size, and cultural condition at affiliated shows
          across the country, and the same criteria decide every award from a first
          Highly Commended Certificate through to a Certificate of Cultural Merit.
        </p>,
      ),
    },
    {
      heading: 'How judging works',
      tone: 'parchment',
      content: prose(
        data?.howItWorks,
        <p>
          Plants are assessed by panels of accredited judges against published criteria for
          form, colour, size, and cultural condition.{' '}
          <span data-placeholder="true">Panels typically comprise three judges</span> and
          convene at affiliated society shows throughout the year, as well as at the
          triennial National Show, where awards are conferred once a plant meets the
          required point threshold for its class.
        </p>,
      ),
    },
    {
      heading: 'Becoming a judge',
      tone: 'parchment',
      content: prose(
        data?.becomingAJudge,
        <p>
          Judging accreditation is earned through a structured training programme run by
          SAOC.{' '}
          <span data-placeholder="true">
            Candidates begin as student judges, attend regional training sessions, and sit
            a probationary period observing panels before accreditation is confirmed
          </span>
          . Speak to your affiliated society to begin the pathway.
        </p>,
      ),
    },
  ];
  const [overview, howItWorks, becoming] = sections;
  const allWithheld = sections.every((section) => section.content === null);
  const split = (section: ProseSection) =>
    section.content === null ? null : (
      <JudgingSplit heading={section.heading} tone={section.tone} marked={!withhold}>
        {section.content}
      </JudgingSplit>
    );
  const awardsSection = (
    <section className="bg-bone py-24">
      <div className="saoc-container">
        <div className="mb-6">
          <h2 className="h2">SAOC awards</h2>
        </div>
        <AwardsGrid awards={awardsList} withhold={withhold} />
      </div>
    </section>
  );

  return (
    <>
      <PageHero
        image="/images/orchid-purple.jpg"
        eyebrow="SAOC judging system"
        heading={data?.title ?? 'Judging at SAOC'}
        lede={LEDE}
      />

      {allWithheld ? (
        <section className="bg-parchment py-24">
          <div className="saoc-container">
            <ContentGap />
          </div>
        </section>
      ) : null}
      {split(overview)}

      {/* Stats strip: Sanity content when present, real figures otherwise; marked on the beta preview */}
      {stats.length > 0 ? (
        <section className="bg-bone py-16">
          <div className="saoc-container">
            <div data-placeholder={withhold ? undefined : 'true'} className="flex flex-col items-start gap-4">
              <dl className="grid w-full grid-cols-2 gap-x-8 gap-y-8 border-y border-rule py-10 sm:grid-cols-4">
                {stats.map((stat, i) => (
                  <div key={`${stat.label}-${i}`}>
                    <dt className="font-serif tracking-[-0.015em] font-light text-[clamp(36px,4vw,56px)] leading-none text-primary">
                      {stat.value}
                    </dt>
                    <dd className="mt-2 font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
                      {stat.label}
                    </dd>
                  </div>
                ))}
              </dl>
              {withhold ? null : <PlaceholderMarker />}
            </div>
          </div>
        </section>
      ) : null}

      {split(howItWorks)}

      <PhotoBand
        image="/images/orchid-dark.jpg"
        alt="Dark orchid on the show bench"
        caption={withhold && isUnsourced(PHOTO_CAPTION) ? undefined : PHOTO_CAPTION}
        marked={!withhold}
        minHeight="320px"
      />

      {/* Awards grid */}
      {awardsSection}

      {split(becoming)}

      {/* Judges directory — conditional */}
      <section className="bg-bone py-16">
        <div className="saoc-container">
          <div className="mb-6">
            <h2 className="h2">Accredited judges</h2>
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
