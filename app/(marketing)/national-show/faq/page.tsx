import type { Metadata } from 'next';
import Link from 'next/link';

import { ShowFaqList } from '@/components/show';
import { hasFaqAnswer } from '@/components/show/ShowFaqList';
import { HoldingState } from '@/components/show/nos/HoldingState';
import { Button } from '@/components/nos/Button';
import { NosHero } from '@/components/nos/NosHero';
import { NosSection } from '@/components/nos/NosSection';
import { sanityFetch } from '@/sanity/lib/fetch';
import { showFaqsQuery, showVisitorInfoQuery } from '@/sanity/queries';
import { loadShowFacts } from '@/lib/data/show-facts';
import { withholdPlaceholderProse } from '@/lib/data/show-pages';
import { buildPageMetadata } from '@/lib/seo';
import type { ShowFaq, ShowVisitorInfo } from '@/types';
import { nosOgImage } from '@/app/(marketing)/national-show/og-image';
import { NosShowIndex } from '@/components/nos/NosShowIndex';

// Bound CDN staleness to 60s, matching every other CMS-backed route on the site.
export const revalidate = 60;

export const metadata: Metadata = buildPageMetadata({
  title: 'Visitor Questions — National Orchid Show',
  image: nosOgImage('Visitor Questions — National Orchid Show'),
  description:
    'Answers to the questions visitors ask most about the South African National Orchid Show — ' +
    'getting there, tickets, accessibility and plant sales.',
  path: '/national-show/faq',
});

export default async function ShowFaqPage() {
  const [info, faqs, facts] = await Promise.all([
    sanityFetch<ShowVisitorInfo>({
      query: showVisitorInfoQuery,
      tags: ['showVisitorInfo', 'sanity'],
    }),
    sanityFetch<ShowFaq[]>({ query: showFaqsQuery, tags: ['showFaq', 'sanity'] }),
    loadShowFacts(),
  ]);

  // R77 #2: a public build shows only answered questions; with none left the page holds.
  const hideUnanswered = withholdPlaceholderProse();
  const holds = hideUnanswered && !(faqs ?? []).some((faq) => faq?.question && hasFaqAnswer(faq));

  return (
    <>
      <NosHero
        route="/national-show/faq"
        title={info?.faqTitle ?? 'Frequently asked questions'}
        // The Sanity intro says unconfirmed answers are marked as such; a public build hides the marks.
        lede={hideUnanswered ? undefined : (info?.faqIntro ?? undefined)}
        priority
      />

      {holds ? (
        <HoldingState route="/national-show/faq" facts={facts} contentState="published" />
      ) : (
        <NosSection wrapClassName="[&_details_p]:max-w-[60ch]">
          <ShowFaqList
            faqs={faqs}
            pendingLabel={info?.pendingLabel}
            researchLabel={info?.researchLabel}
            hideUnanswered={hideUnanswered}
          />

          <div className="mt-14 border-t border-rule pt-8">
            {info?.faqContactNote ? (
              <p className="max-w-[60ch] font-sans text-[16px] leading-relaxed text-ink/80">
                {info.faqContactNote}
              </p>
            ) : null}
            <div className="mt-5 flex flex-wrap gap-4">
              <Button as={Link} href="/contact" variant="primary">
                Ask the council →
              </Button>
              <Button as={Link} href="/national-show/plan-your-visit" variant="ghost">
                Plan your visit
              </Button>
            </div>
          </div>
        </NosSection>
      )}
      <NosShowIndex current="/national-show/faq" />
    </>
  );
}
