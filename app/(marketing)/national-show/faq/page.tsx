import type { Metadata } from 'next';
import Link from 'next/link';

import { PageHero } from '@/components/ui/PageHero';
import { ShowFaqList, ShowSectionNav } from '@/components/show';
import { sanityFetch } from '@/sanity/lib/fetch';
import { showFaqsQuery, showVisitorInfoQuery } from '@/sanity/queries';
import type { ShowFaq, ShowVisitorInfo } from '@/types';

// Bound CDN staleness to 60s, matching every other CMS-backed route on the site.
export const revalidate = 60;

export const metadata: Metadata = {
  title: 'Visitor Questions — National Orchid Show',
  description:
    'Answers to the questions visitors ask most about the South African National Orchid Show — ' +
    'getting there, tickets, accessibility and plant sales.',
};

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
      <PageHero
        image="/images/orchid-pink.jpg"
        eyebrow="National Show"
        heading={info?.faqTitle ?? 'Frequently asked questions'}
        lede={info?.faqIntro ?? undefined}
      />

      <div className="mx-auto max-w-[900px] px-8 py-16">
        <ShowFaqList
          faqs={faqs}
          pendingLabel={info?.pendingLabel}
          researchLabel={info?.researchLabel}
        />

        <div className="mt-14 border-t border-rule pt-8">
          {info?.faqContactNote ? (
            <p className="font-sans text-[16px] leading-relaxed text-ink/80">
              {info.faqContactNote}
            </p>
          ) : null}
          <div className="mt-5 flex flex-wrap gap-4">
            <Link
              href="/contact"
              className="bg-primary px-6 py-3 font-sans text-[14px] font-medium text-ivory transition-colors duration-150 hover:bg-primary-800"
            >
              Ask the council →
            </Link>
            <Link
              href="/national-show/plan-your-visit"
              className="border border-ink/30 px-6 py-3 font-sans text-[14px] font-medium text-ink transition-colors duration-150 hover:bg-ink/5"
            >
              Plan your visit
            </Link>
          </div>
        </div>
      </div>

      <ShowSectionNav current="/national-show/faq" />
    </>
  );
}
