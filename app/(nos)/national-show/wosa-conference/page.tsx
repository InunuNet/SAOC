import { PortableText } from '@portabletext/react';
import type { Metadata } from 'next';
import { defineQuery } from 'next-sanity';

import { heroFactsForEvent, NosHero } from '@/components/nos/NosHero';
import { NosShowIndex } from '@/components/nos/NosShowIndex';
import { PresenterSection } from '@/components/nos/PresenterSection';
import { NOS_ROUTE_HEROES } from '@/components/nos/nos-route-heroes';
import { TicketCard } from '@/components/tickets/keepsake';
import { loadTicketCardViewModels } from '@/lib/data/admission-availability';
import { FAQ_SECTIONS } from '@/lib/data/faq-sections';
import { loadShowFacts } from '@/lib/data/show-facts';
import { withholdPlaceholderProse } from '@/lib/data/show-pages';
import { TICKET_PRODUCTS } from '@/lib/data/ticket-presentation';
import { buildPageMetadata } from '@/lib/seo';
import { withTicketingTestTitle } from '@/lib/ticketing-test-metadata';
import { loadPresenterViewModels } from '@/lib/view-models/load-presenters';
import { sanityFetch } from '@/sanity/lib/fetch';
import type { ShowFaq } from '@/types';
import { nosOgImage } from '@/app/(nos)/national-show/og-image';

// WO-G1 (NOS Design, comms.md 2026-10-25): hero, one 7/5 grid with the ticket beside her WOSA copy, her
// FAQ section 7 questions, and no presenters until a conferencePresenter has event = wosa-conference.
// F12 (national-show-ia-alignment, M4): SAOC is orchids IN CULTIVATION; wild orchid identification,
// habitat and conservation belong to WOSA's own site, so this page states what the conference is and
// generates no wild-orchid content of its own (goldens/m3/wosa-content-boundary.golden.md).
//
// Every string is hers: the standfirst is the WOSA sentence of What to Expect v1.0, the paragraph is About
// v1.2 section 2.1, the lede is her FAQ section 7 introduction, and the questions are showFaq q46, q49, q51
// and q53-q56 as published. q48 (date) is in the hero, q50 and q52 (price, early bird) are on the ticket.
// The three placeholder sections of content/show-pages/07-wosa-conference.json were builder copy (R7) and
// are gone. `dynamic = 'force-dynamic'`: the ticket card reaches Firebase Admin, as on the symposium page.
export const dynamic = 'force-dynamic';
export const revalidate = 60;

const EVENT = 'wosa-conference';
const FAQ_HEADING = 'Frequently asked questions';
const FAQ_IDS = ['showFaq-q46', 'showFaq-q49', 'showFaq-q51', 'showFaq-q53', 'showFaq-q54', 'showFaq-q55', 'showFaq-q56'];
// What to Expect v1.0, the WOSA sentence, word for word.
const STANDFIRST =
  "A Conference held by Wild Orchids Southern Africa (WOSA) will highlight the ecology and conservation of indigenous orchids, illustrating how research undertaken in natural habitats continues to influence cultivation practices, breeding programmes and the long-term future of orchids.";
// About v1.2, section 2.1, the WOSA paragraph, word for word.
const WOSA_PARAGRAPH =
  "An important feature of the 2027 programme will be the participation of Wild Orchids of Southern Africa (WOSA). They will hold their annual conference as part of the National Orchid Show. Their involvement reflects the National Orchid Show's commitment to connecting conservation science with horticultural excellence, demonstrating how knowledge gained from orchids in the wild continues to shape responsible cultivation and the future sustainability of the orchid community.";
const WOSA_FAQ_QUERY = defineQuery(`
  *[_type == "showFaq" && active == true && _id in $ids] | order(order asc){
    _id,
    question,
    answer,
    order
  }
`);

export const metadata: Metadata = withTicketingTestTitle(
  buildPageMetadata({
    title: NOS_ROUTE_HEROES.wosaConference.title,
    image: nosOgImage('WOSA Conference — National Orchid Show'),
    description: 'The WOSA Conference, held alongside the National Show, and what it is for.',
    path: '/national-show/wosa-conference',
  })
);

function conferenceLede(): string | undefined {
  const [lede] = FAQ_SECTIONS.find((section) => section.id === 'wosa-conference')?.intro ?? [];
  return lede;
}

export default async function WosaConferencePage() {
  // A Sanity or Firebase failure must never turn this public page into a 500 (Codex finding, 2026-10-07).
  const [showFacts, presenters, ticketCards, faqs] = await Promise.all([
    loadShowFacts(),
    loadPresenterViewModels(EVENT),
    loadTicketCardViewModels().catch((error: unknown) => {
      console.error('[national-show/wosa-conference] loadTicketCardViewModels failed:', error);
      return null;
    }),
    sanityFetch<ShowFaq[]>({
      query: WOSA_FAQ_QUERY,
      params: { ids: FAQ_IDS },
      tags: ['showFaq', 'sanity'],
    }),
  ]);
  const card = ticketCards?.cards.wosa ?? null;
  const answered = (faqs ?? []).filter((faq) => faq.question && (faq.answer ?? []).length > 0);

  return (
    <>
      <NosHero
        route="/national-show/wosa-conference"
        title={NOS_ROUTE_HEROES.wosaConference.title}
        crumbLabel={NOS_ROUTE_HEROES.wosaConference.title}
        lede={conferenceLede()}
        facts={heroFactsForEvent(showFacts, TICKET_PRODUCTS.wosa)}
        priority
      />

      <div className="nos-ev-body">
        <div data-nos-wrap="">
          <div className="nos-ev-grid">
            <div className="nos-ev-main">
              <p className="doc-standfirst">{STANDFIRST}</p>
              <p>{WOSA_PARAGRAPH}</p>
              {answered.length > 0 ? (
                <section className="nos-ev-faq" aria-labelledby="wosa-faq-h">
                  <h2 id="wosa-faq-h">{FAQ_HEADING}</h2>
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
              <aside className="nos-ev-ticket" aria-label="WOSA Conference ticket">
                <div className="nk-grid">
                  <div className="nk-wrap">
                    <TicketCard
                      productId="wosa"
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
          <PresenterSection presenters={presenters} />
        </div>
      </div>
      <NosShowIndex current="/national-show/wosa-conference" />
    </>
  );
}
