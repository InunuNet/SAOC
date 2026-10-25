import { PortableText } from '@portabletext/react';
import type { Metadata } from 'next';
import { defineQuery } from 'next-sanity';

import { heroFactsFromShow, NosHero } from '@/components/nos/NosHero';
import { NOS_ROUTE_HEROES } from '@/components/nos/nos-route-heroes';
import { NosShowIndex } from '@/components/nos/NosShowIndex';
import { TicketCard } from '@/components/tickets/keepsake';
import { loadTicketCardViewModels } from '@/lib/data/admission-availability';
import { loadShowFacts } from '@/lib/data/show-facts';
import { withholdPlaceholderProse } from '@/lib/data/show-pages';
import { buildPageMetadata } from '@/lib/seo';
import { withTicketingTestTitle } from '@/lib/ticketing-test-metadata';
import { sanityFetch } from '@/sanity/lib/fetch';
import type { ShowFaq } from '@/types';
import { nosOgImage } from '@/app/(nos)/national-show/og-image';

// WK-G1 (NOS Design, comms.md 2026-10-25): hero with no lede, one 7/5 grid with her FAQ 57 copy and
// FAQ 58-60 beside the live Workshops ticket card. Every string is hers (FAQ v1.0, section 8): the
// standfirst and the body are the first two sentences of question 57, and the third is dropped because
// this page is the website. The build's own status box, its chip, its session-times sentences, the
// section heading above the cards and the cocktail card (an event, kept on /tickets and /programme) are
// gone. Workshop records render here once SAOC enters them in Sanity (workshopSession: level, duration,
// included, bring); none exist yet, so there is nothing to draw.
// `dynamic = 'force-dynamic'`: the ticket card reaches Firebase Admin, as on the symposium page.
export const dynamic = 'force-dynamic';

const FACTS_LABELS = ['Dates', 'Venue', 'Host'] as const;
const FAQ_HEADING = 'Frequently asked questions';
const FAQ_IDS = ['showFaq-q58', 'showFaq-q59', 'showFaq-q60'];
// FAQ v1.0 question 57, its first two sentences, word for word.
const STANDFIRST = "Workshops are planned as part of the wider event programme.";
const BODY = "The topics, instructors, dates, costs and booking arrangements are to be confirmed.";
const WORKSHOP_FAQ_QUERY = defineQuery(`
  *[_type == "showFaq" && active == true && _id in $ids] | order(order asc){
    _id,
    question,
    answer,
    order
  }
`);

export const metadata: Metadata = withTicketingTestTitle(
  buildPageMetadata({
    title: NOS_ROUTE_HEROES.workshops.title,
    image: nosOgImage('Workshops — National Show'),
    description: STANDFIRST,
    path: '/national-show/workshops',
  })
);

export default async function WorkshopsPage() {
  // A Sanity or Firebase failure must never turn this public page into a 500.
  const [showFacts, ticketCards, faqs] = await Promise.all([
    loadShowFacts(),
    loadTicketCardViewModels().catch((error: unknown) => {
      console.error('[national-show/workshops] loadTicketCardViewModels failed:', error);
      return null;
    }),
    sanityFetch<ShowFaq[]>({
      query: WORKSHOP_FAQ_QUERY,
      params: { ids: FAQ_IDS },
      tags: ['showFaq', 'sanity'],
    }),
  ]);
  const card = ticketCards?.cards.workshops ?? null;
  const answered = (faqs ?? []).filter((faq) => faq.question && (faq.answer ?? []).length > 0);

  return (
    <>
      <NosHero
        route={NOS_ROUTE_HEROES.workshops.route}
        title={NOS_ROUTE_HEROES.workshops.title}
        crumbLabel={NOS_ROUTE_HEROES.workshops.title}
        facts={heroFactsFromShow(showFacts, FACTS_LABELS)}
        priority
      />

      <div className="nos-ev-body" data-doc-layout="">
        <div data-nos-wrap="">
          <div className="nos-ev-grid">
            <div className="nos-ev-main" data-doc-main="">
              <p className="doc-standfirst">{STANDFIRST}</p>
              <p>{BODY}</p>
              {answered.length > 0 ? (
                <section className="nos-ev-faq" aria-labelledby="workshops-faq-h">
                  <h2 id="workshops-faq-h">{FAQ_HEADING}</h2>
                  <div className="nos-qa">
                    {answered.map((faq) => (
                      <div key={faq._id}>
                        <h3>{faq.question}</h3>
                        <PortableText value={faq.answer ?? []} />
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}
            </div>
            {card ? (
              <aside className="nos-ev-ticket" data-doc-aside="" data-doc-aside-kind="content" aria-label="Workshops ticket">
                <div className="nk-grid">
                  <div className="nk-wrap">
                    <TicketCard
                      productId="workshops"
                      vm={card}
                      name={card.name}
                      partnerName={null}
                      showProvisional={!withholdPlaceholderProse()}
                    />
                  </div>
                </div>
              </aside>
            ) : null}
          </div>
        </div>
      </div>
      <NosShowIndex current="/national-show/workshops" />
    </>
  );
}
