import type { Metadata } from 'next';
import Link from 'next/link';

import { ShowFaqList } from '@/components/show';
import { Button } from '@/components/nos/Button';
import { NosHero } from '@/components/nos/NosHero';
import { NosSection } from '@/components/nos/NosSection';
import { sanityFetch } from '@/sanity/lib/fetch';
import { showFaqsQuery, showVisitorInfoQuery } from '@/sanity/queries';
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
  const [info, faqs] = await Promise.all([
    sanityFetch<ShowVisitorInfo>({
      query: showVisitorInfoQuery,
      tags: ['showVisitorInfo', 'sanity'],
    }),
    sanityFetch<ShowFaq[]>({ query: showFaqsQuery, tags: ['showFaq', 'sanity'] }),
  ]);

  return (
    <>
      <NosHero
        route="/national-show/faq"
        title={info?.faqTitle ?? 'Frequently asked questions'}
        lede={info?.faqIntro ?? undefined}
        priority
      />

      <NosSection wrapClassName="[&_details_p]:max-w-[60ch]">
        <ShowFaqList
          faqs={faqs}
          pendingLabel={info?.pendingLabel}
          researchLabel={info?.researchLabel}
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
      <NosShowIndex current="/national-show/faq" />
    </>
  );
}
