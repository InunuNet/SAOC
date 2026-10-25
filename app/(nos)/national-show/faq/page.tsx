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
import { showFaqsQuery, showVisitorInfoQuery } from '@/sanity/queries';
import { loadTicketCardViewModels } from '@/lib/data/admission-availability';
import { FAQ_SECTIONS } from '@/lib/data/faq-sections';
import { loadShowFacts } from '@/lib/data/show-facts';
import { withholdPlaceholderProse } from '@/lib/data/show-pages';
import { buildPageMetadata } from '@/lib/seo';
import type { ShowFaq, ShowVisitorInfo } from '@/types';
import { nosOgImage } from '@/app/(nos)/national-show/og-image';
import { NosShowIndex } from '@/components/nos/NosShowIndex';
import { saocUrl } from '@/lib/site-hosts';

// The order ShowFaqList lays its sections out in (her order, FAQ_SECTIONS); the FAQPage node follows
// it so the markup reads in the order the page does. An unknown category sorts with the first section,
// where ShowFaqList draws it.
function categoryRank(faq: ShowFaq): number {
  const rank = FAQ_SECTIONS.findIndex((section) => section.id === faq.category);
  return rank === -1 ? 0 : rank;
}

// Her Q10, "How much do tickets cost?": the one question the ticket-price list follows.
const PRICES_FAQ_ID = 'showFaq-q10';

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
  const [info, faqs, facts, loaded] = await Promise.all([
    sanityFetch<ShowVisitorInfo>({
      query: showVisitorInfoQuery,
      tags: ['showVisitorInfo', 'sanity'],
    }),
    sanityFetch<ShowFaq[]>({ query: showFaqsQuery, tags: ['showFaq', 'sanity'] }),
    loadShowFacts(),
    loadTicketCardViewModels(),
  ]);

  // R77 #2: a public build shows only answered questions; with none left the page holds.
  const hideUnanswered = withholdPlaceholderProse();
  // r57: one row is answered from a fact the site already publishes, so it cannot disagree with the
  // page that publishes it: the cost row (her Q10) reads the tickets hub's own loader and labels, and
  // follows her answer rather than replacing it. Her venue answer (Q18) is shown as she wrote it.
  const wired: Record<string, WiredFaq> = {};
  const priceLabels = admissionPriceLabels(loaded.cards);
  if (priceLabels.length > 0) {
    wired[PRICES_FAQ_ID] = {
      kind: 'prices',
      text: priceLabels.join('; '),
      replaces: false,
      body: (
        <>
          <AdmissionPriceList cards={loaded.cards} />
          <Button as={Link} href="/tickets" variant="ghost" className="mt-4">
            {info?.admissionLinkLabel ?? 'See ticket prices and book'} →
          </Button>
        </>
      ),
    };
  }

  // ONE derived list: what the page shows, in the order it shows it (ShowFaqList lays its
  // sections out by category, and keeps this order within each). The list and the FAQPage node
  // both come from it, so a future hide rule applies to both.
  // r57b: a public build shows a row only when its answer has a source: the row is wired (read from
  // a published fact) or the committee has confirmed it (its Sanity status). A section left with no
  // row is not drawn by ShowFaqList. A preview build keeps every row.
  const sortedFaqs = [...(faqs ?? [])]
    .filter((faq) => faq?.question)
    .sort((a, b) => categoryRank(a) - categoryRank(b));
  const isSourced = (faq: ShowFaq) =>
    Boolean(wired[faq._id]) || (faq.status === 'confirmed' && hasFaqAnswer(faq));
  const visibleFaqs = sortedFaqs.filter((faq) => !hideUnanswered || isSourced(faq));
  const withheldCount = sortedFaqs.length - visibleFaqs.length;
  const holds = hideUnanswered && visibleFaqs.length === 0;

  // SEO: the entries the page presents as settled, i.e. the sourced rows. r57b (Codi, H4): each
  // answer is the row's visible answer word for word, so a wired row reads its resolved fact (the
  // venue name, the hub's price list), never the Sanity prose it replaces.
  const answerText = (faq: ShowFaq) => {
    const sanityText = portableTextToPlainText(faq.answer ?? []);
    const wiredRow = wired[faq._id];
    if (!wiredRow) return sanityText;
    return wiredRow.replaces
      ? wiredRow.text
      : [sanityText, wiredRow.text].filter(Boolean).join(' ');
  };
  const faqEntries = visibleFaqs
    .filter((faq) => isSourced(faq))
    .map((faq) => ({ question: faq.question as string, answer: answerText(faq) }))
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
          {!hideUnanswered || withheldCount > 0 ? (
            <ShowStatusLine
              kind="confirmation"
              status="pending"
              pendingLabel={info?.pendingLabel}
              researchLabel={info?.researchLabel}
            />
          ) : null}
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
              <Button as="a" href={saocUrl('/contact')} variant="primary">
                Ask the council →
              </Button>
              <Button as={Link} href="/plan-your-visit" variant="ghost">
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
