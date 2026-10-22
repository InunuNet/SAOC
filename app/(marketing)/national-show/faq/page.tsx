import type { Metadata } from 'next';
import Link from 'next/link';

import { JsonLd, faqPageJsonLd, portableTextToPlainText } from '@/components/seo/JsonLd';
import { ShowFaqList, ShowStatusLine } from '@/components/show';
import { AdmissionPriceList, admissionPriceLabels } from '@/components/show/AdmissionPriceList';
import { hasFaqAnswer, type WiredFaq } from '@/components/show/ShowFaqList';
import { HoldingState } from '@/components/show/nos/HoldingState';
import { Button } from '@/components/nos/Button';
import { NosHero } from '@/components/nos/NosHero';
import { NosSection } from '@/components/nos/NosSection';
import { sanityFetch } from '@/sanity/lib/fetch';
import { nationalShowQuery, showFaqsQuery, showVisitorInfoQuery } from '@/sanity/queries';
import { loadTicketCardViewModels } from '@/lib/data/admission-availability';
import { loadShowFacts, type ShowFactsSource } from '@/lib/data/show-facts';
import { withholdPlaceholderProse } from '@/lib/data/show-pages';
import { buildPageMetadata } from '@/lib/seo';
import type { ShowFaq, ShowVisitorInfo } from '@/types';
import { nosOgImage } from '@/app/(marketing)/national-show/og-image';
import { NosShowIndex } from '@/components/nos/NosShowIndex';

// The order ShowFaqList lays its category sections out in; the FAQPage node follows it so the
// markup reads in the order the page does.
const FAQ_CATEGORY_ORDER = ['getting-there', 'tickets', 'accessibility', 'plant-sales', 'general'];

function categoryRank(faq: ShowFaq): number {
  const rank = FAQ_CATEGORY_ORDER.indexOf(faq.category ?? '');
  return rank === -1 ? FAQ_CATEGORY_ORDER.indexOf('general') : rank;
}

// Bound CDN staleness to 60s, matching every other CMS-backed route on the site.
export const revalidate = 60;

export const metadata: Metadata = buildPageMetadata({
  title: 'Frequently asked questions',
  image: nosOgImage('Visitor Questions — National Orchid Show'),
  description:
    'Answers to the questions visitors ask most about the South African National Orchid Show — ' +
    'getting there, tickets, accessibility and plant sales.',
  path: '/national-show/faq',
});

export default async function ShowFaqPage() {
  const [info, faqs, facts, show, loaded] = await Promise.all([
    sanityFetch<ShowVisitorInfo>({
      query: showVisitorInfoQuery,
      tags: ['showVisitorInfo', 'sanity'],
    }),
    sanityFetch<ShowFaq[]>({ query: showFaqsQuery, tags: ['showFaq', 'sanity'] }),
    loadShowFacts(),
    sanityFetch<ShowFactsSource>({ query: nationalShowQuery, tags: ['nationalShow', 'sanity'] }),
    loadTicketCardViewModels(),
  ]);

  // R77 #2: a public build shows only answered questions; with none left the page holds.
  const hideUnanswered = withholdPlaceholderProse();
  // ONE derived list: what the page shows, in the order it shows it (ShowFaqList lays its
  // sections out by category, and keeps this order within each). The list and the FAQPage node
  // both come from it, so a future hide rule applies to both.
  const visibleFaqs = [...(faqs ?? [])]
    .filter((faq) => faq?.question && (!hideUnanswered || hasFaqAnswer(faq)))
    .sort((a, b) => categoryRank(a) - categoryRank(b));
  const holds = hideUnanswered && visibleFaqs.length === 0;

  // r57: two rows are answered from facts the site already publishes, so they cannot disagree with
  // the page that publishes them. The cost row reads the tickets hub's own loader and labels; the
  // venue row reads the show's venue.name (the fact strip's source), only while the committee has
  // confirmed the venue. Either falls back to its Sanity answer when its source has nothing.
  const wired: Record<string, WiredFaq> = {};
  if (admissionPriceLabels(loaded.cards).length > 0) {
    wired['showFaq-tickets-1'] = {
      kind: 'prices',
      replaces: false,
      body: (
        <>
          <AdmissionPriceList cards={loaded.cards} />
          <Button as={Link} href="/national-show/tickets" variant="ghost" className="mt-4">
            {info?.admissionLinkLabel ?? 'See ticket prices and book'} →
          </Button>
        </>
      ),
    };
  }
  if (show?.venue?.name && info?.confirmations?.venue === 'confirmed') {
    wired['showFaq-getting-there-3'] = {
      kind: 'venue',
      replaces: true,
      body: <p>{show.venue.name}</p>,
    };
  }

  // SEO: the entries the page presents as settled. A public build (`hideUnanswered`) renders no
  // badges, so every answered entry there reads as settled; a beta build badges everything that
  // is not 'confirmed'.
  const faqEntries = visibleFaqs
    .filter((faq) => hasFaqAnswer(faq) && (hideUnanswered || faq.status === 'confirmed'))
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
        title={info?.faqTitle ?? 'Frequently asked questions'}
        // The Sanity intro says unconfirmed answers are marked as such; a public build hides the marks.
        lede={hideUnanswered ? undefined : (info?.faqIntro ?? undefined)}
        priority
      />

      {holds ? (
        <HoldingState facts={facts} contentState="published" />
      ) : (
        <NosSection wrapClassName="[&_details_p]:max-w-[60ch]">
          {hideUnanswered ? null : (
            <ShowStatusLine
              kind="confirmation"
              status="pending"
              pendingLabel={info?.pendingLabel}
              researchLabel={info?.researchLabel}
            />
          )}
          <ShowFaqList
            faqs={visibleFaqs}
            pendingLabel={info?.pendingLabel}
            researchLabel={info?.researchLabel}
            hideUnanswered={hideUnanswered}
            wired={wired}
          />

          <div className="mt-14 border-t border-rule pt-8">
            {info?.faqContactNote ? (
              <p className="max-w-[60ch] font-sans text-[16px] leading-[1.55] text-ink/80">
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
