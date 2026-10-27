import type { Metadata } from 'next';

import { JsonLd, faqPageJsonLd, portableTextToPlainText } from '@/components/seo/JsonLd';
import { ShowFaqList, faqIndexEntries, faqGroups, hasFaqAnswer } from '@/components/show/ShowFaqList';
import { HoldingState } from '@/components/show/nos/HoldingState';
import { heroFactsFromShow, NosHero } from '@/components/nos/NosHero';
import { DocumentLayout } from '@/components/ui/DocumentLayout';
import { sanityFetch } from '@/sanity/lib/fetch';
import { showFaqsQuery, showVisitorInfoQuery } from '@/sanity/queries';
import { FAQ_SECTIONS } from '@/lib/data/faq-sections';
import { loadShowFacts } from '@/lib/data/show-facts';
import { withholdPlaceholderProse } from '@/lib/data/show-pages';
import { buildPageMetadata } from '@/lib/seo';
import type { ShowFaq, ShowVisitorInfo } from '@/types';
import { nosOgImage } from '@/app/(nos)/national-show/og-image';

// FQ-G1 (NOS Design): the page's own title. Her document's first line repeats the header lockup,
// so it is neither the h1 nor a lede; the hero holds the h1 and the show facts.
const PAGE_TITLE = 'Frequently asked questions';
const FACTS_LABELS = ['Dates', 'Venue', 'Host'] as const;

// The order ShowFaqList lays its sections out in (her order, FAQ_SECTIONS); the FAQPage node follows
// it so the markup reads in the order the page does. An unknown category sorts with the first section,
// where ShowFaqList draws it.
function categoryRank(faq: ShowFaq): number {
  const rank = FAQ_SECTIONS.findIndex((section) => section.id === faq.category);
  return rank === -1 ? 0 : rank;
}

// Bound CDN staleness to 60s, matching every other CMS-backed route on the site.
export const revalidate = 60;

export const metadata: Metadata = buildPageMetadata({
  title: 'Frequently asked questions',
  image: nosOgImage('Visitor Questions — National Orchid Show'),
  description:
    'Answers to the questions visitors ask most about the National Orchid Show — ' +
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

  // ONE derived list: what the page shows, in the order it shows it (ShowFaqList lays its
  // sections out by category, and keeps this order within each). The list and the FAQPage node
  // both come from it, so a future hide rule applies to both.
  // r57b: a public build shows a row only when the committee has confirmed its answer (its Sanity
  // status). A section left with no row is not drawn by ShowFaqList. A preview build keeps every row.
  const sortedFaqs = [...(faqs ?? [])]
    .filter((faq) => faq?.question)
    .sort((a, b) => categoryRank(a) - categoryRank(b));
  const isSourced = (faq: ShowFaq) => faq.status === 'confirmed' && hasFaqAnswer(faq);
  const visibleFaqs = sortedFaqs.filter((faq) => !hideUnanswered || isSourced(faq));
  const holds = hideUnanswered && visibleFaqs.length === 0;
  const index = faqIndexEntries(faqGroups(visibleFaqs, hideUnanswered));

  // SEO: the entries the page presents as settled, i.e. the sourced rows, each answer word for word.
  const faqEntries = visibleFaqs
    .filter((faq) => isSourced(faq))
    .map((faq) => ({
      question: faq.question as string,
      answer: portableTextToPlainText(faq.answer ?? []),
    }))
    .filter((entry) => entry.answer !== '');

  return (
    <>
      {faqEntries.length > 0 ? <JsonLd data={faqPageJsonLd(faqEntries)} /> : null}
      <NosHero
        route="/national-show/faq"
        title={PAGE_TITLE}
        crumbLabel="FAQ"
        facts={heroFactsFromShow(facts, FACTS_LABELS)}
        priority
      />

      {holds ? (
        <HoldingState facts={facts} contentState="published" />
      ) : (
        <DocumentLayout index={index}>
          <ShowFaqList
            faqs={visibleFaqs}
            pendingLabel={info?.pendingLabel}
            researchLabel={info?.researchLabel}
            hideUnanswered={hideUnanswered}
          />
        </DocumentLayout>
      )}
    </>
  );
}
