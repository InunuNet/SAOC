import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import { PortableText } from '@portabletext/react';
import type { PortableTextBlock } from '@portabletext/react';

import { Breadcrumb } from '@/components/chrome/Breadcrumb';
import { DocumentLayout, type DocumentIndexEntry } from '@/components/ui/DocumentLayout';
import { RouteHero } from '@/components/ui/RouteHero';
import { PhotoBand } from '@/components/ui/PhotoBand';
import { CTASection } from '@/components/ui/CTASection';
import { ContentGap } from '@/components/ui/ContentGap';
import { isUnsourced, sourcedBlocks } from '@/components/ui/provenance';
import { PlaceholderMarker } from '@/components/ui/PlaceholderMarker';
import { AwardsGrid, JudgesDirectory } from '@/components/judging';
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

interface JudgingPageData {
  title?: string | null;
  intro?: PortableTextBlock[] | null;
  howItWorks?: PortableTextBlock[] | null;
  becomingAJudge?: PortableTextBlock[] | null;
  showPublicDirectory?: boolean | null;
  judges?: SanityJudge[] | null;
}

const PHOTO_CAPTION = 'Form, colour, size, condition — judged against published criteria';

interface ProseSection {
  id: string;
  heading: string;
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

  const prose = (blocks: PortableTextBlock[] | null | undefined, fallback: ReactNode) => {
    if (blocks && blocks.length > 0) {
      const shown = withhold ? sourcedBlocks(blocks) : blocks;
      return shown ? <PortableText value={shown} /> : null;
    }
    return withhold ? null : fallback;
  };

  const sections: ProseSection[] = [
    {
      id: 'overview',
      heading: 'Overview',
      content: prose(
        data?.intro,
        <p>
          SAOC operates a national orchid judging system, standardised in 1990 to replace
          regional variation with a single set of published criteria. Accredited judges
          score plants on form, colour, size, and cultural condition at affiliated shows
          across the country, and the same criteria decide every award from a first
          Highly Commended Certificate through to a Certificate of Cultural Merit.
        </p>,
      ),
    },
    {
      id: 'how-judging-works',
      heading: 'How judging works',
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
      id: 'becoming-a-judge',
      heading: 'Becoming a judge',
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
  const proseSection = (section: ProseSection) =>
    section.content === null ? null : (
      <section key={section.id} id={section.id} className="doc-section">
        <h2 className="doc-h2">{section.heading}</h2>
        <div data-placeholder={withhold ? undefined : 'true'} className="doc-prose">
          {section.content}
          {withhold ? null : <PlaceholderMarker />}
        </div>
      </section>
    );

  const index: DocumentIndexEntry[] = [
    ...[overview, howItWorks].filter((s) => s.content !== null),
    { id: 'awards', heading: 'SAOC awards' },
    ...[becoming].filter((s) => s.content !== null),
    { id: 'judges', heading: 'Accredited judges' },
  ].map((entry) => ({ id: entry.id, label: entry.heading }));

  return (
    <>
      <Breadcrumb items={[{ label: 'Judging' }]} />
      <RouteHero
        route="/judging"
        eyebrow="SAOC judging system"
        heading={data?.title ?? 'Judging at SAOC'}
        lede={LEDE}
      />

      <DocumentLayout index={index}>
        {allWithheld ? (
          <section className="doc-section">
            <div className="doc-prose">
              <ContentGap />
            </div>
          </section>
        ) : null}
        {proseSection(overview)}
        {proseSection(howItWorks)}

        {/* Awards grid */}
        <section id="awards" className="doc-section">
          <h2 className="doc-h2">SAOC awards</h2>
          <AwardsGrid awards={awardsList} withhold={withhold} />
        </section>

        {proseSection(becoming)}

        {/* Judges directory — conditional */}
        <section id="judges" className="doc-section">
          <h2 className="doc-h2">Accredited judges</h2>
          <JudgesDirectory judges={judges} showPublicDirectory={showDirectory} />
        </section>
      </DocumentLayout>

      <PhotoBand
        image="/images/orchid-purple.jpg"
        alt="Purple orchid on the show bench"
        objectPosition="80% 45%"
        caption={withhold && isUnsourced(PHOTO_CAPTION) ? undefined : PHOTO_CAPTION}
        marked={!withhold}
        minHeight="320px"
      />

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
