import type { Metadata } from 'next';
import Link from 'next/link';

import { NosHero, heroFactsForEvent } from '@/components/nos/NosHero';
import { NOS_ROUTE_HEROES } from '@/components/nos/nos-route-heroes';
import { NosShowIndex } from '@/components/nos/NosShowIndex';
import { SalesStatusLine, TicketCard } from '@/components/tickets/keepsake';
import { DocumentLayout } from '@/components/ui/DocumentLayout';
import { loadTicketCardViewModels } from '@/lib/data/admission-availability';
import { loadShowFacts } from '@/lib/data/show-facts';
import { withholdPlaceholderProse } from '@/lib/data/show-pages';
import {
  TICKET_PRODUCTS,
  partnerNameOf,
  type TicketProductId,
} from '@/lib/data/ticket-presentation';
import { nosPath } from '@/lib/nos-paths';
import { buildPageMetadata } from '@/lib/seo';
import { withTicketingTestTitle } from '@/lib/ticketing-test-metadata';
import { nosOgImage } from '@/app/(nos)/national-show/og-image';

// CR-G1 (NOS Design, comms.md 2026-10-25): no lede, event-labelled facts, then one row per conference,
// each its h2 (the nav label), her FAQ section introduction as the standfirst, her FAQ answer as the body,
// the link to its page, and its live ticket card. Every string is hers (FAQ v1.0: sections 6 and 7, then
// questions 38 and 47). The builder lede and the "Programme" heading are gone. Below 1024 a row reads
// h2, standfirst, ticket, body, link, so the ticket comes before the long description.
// Live stock reaches this page through Firebase Admin credentials that exist only at runtime,
// so it can never be prerendered at build time. Deliberately no Event markup: ticketType carries no
// session date, and inventing one to unlock a rich result is exactly what M6/B8d forbids.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = withTicketingTestTitle(
  buildPageMetadata({
    title: NOS_ROUTE_HEROES.conferences.title,
    image: nosOgImage('Conference registration — National Show'),
    description: "For visitors interested in orchid science, cultivation, conservation and horticulture.",
    path: '/national-show/conferences',
  })
);

interface ConferenceRow {
  id: Extract<TicketProductId, 'symposium' | 'wosa'>;
  heading: string;
  standfirst: string;
  body: string;
  linkLabel: string;
  href: string;
}

// The row headings are the show nav labels (CR-G1).
// FAQ v1.0: section 6 / 7 introductions (first sentence), questions 38 / 47 (answers).
const CONFERENCE_ROWS: readonly ConferenceRow[] = [
  {
    id: 'symposium',
    heading: 'Symposium',
    standfirst: "For visitors interested in orchid science, cultivation, conservation and horticulture.",
    body: "The Symposium is an educational programme forming part of the National Orchid Show, bringing together knowledgeable speakers to share information about orchids, their cultivation, genetics, distribution, natural habitats and conservation.",
    linkLabel: 'About the Symposium',
    href: '/symposium',
  },
  {
    id: 'wosa',
    heading: 'WOSA Conference',
    standfirst: "For Wild Orchids Southern Africa members, conservation enthusiasts and conference delegates.",
    body: "The 7th WOSA Conference will be held in conjunction with the National Orchid Show in September 2027. It is planned as a one-day event focusing on wild orchids and related conservation and botanical topics.",
    linkLabel: 'About the WOSA Conference',
    href: '/wosa-conference',
  },
];

export default async function ConferencesTicketsPage() {
  const [{ cards, salesOpen }, showFacts] = await Promise.all([
    loadTicketCardViewModels(),
    loadShowFacts(),
  ]);
  const showProvisional = !withholdPlaceholderProse();
  const dateOf = (id: 'symposium' | 'wosa') =>
    heroFactsForEvent(showFacts, TICKET_PRODUCTS[id]).find((fact) => fact.term === 'Date')?.value;
  const symposiumDate = dateOf('symposium');
  const wosaDate = dateOf('wosa');
  const facts = [
    ...(symposiumDate ? [{ term: 'Symposium', value: symposiumDate }] : []),
    ...(wosaDate ? [{ term: 'WOSA Conference', value: wosaDate }] : []),
    ...(TICKET_PRODUCTS.symposium.meta
      ? [{ term: 'Time', value: TICKET_PRODUCTS.symposium.meta }]
      : []),
  ];

  return (
    <>
      <NosHero
        route={NOS_ROUTE_HEROES.conferences.route}
        title={NOS_ROUTE_HEROES.conferences.title}
        crumbLabel={NOS_ROUTE_HEROES.conferences.title}
        facts={facts}
        className="nos-hero-cr"
        priority
      />
      {!salesOpen ? <SalesStatusLine /> : null}
      <div className="nos-cr-body">
        {CONFERENCE_ROWS.map((row) => {
          const vm = cards[row.id];
          return (
            <section
              key={row.id}
              data-conference-row=""
              className="nos-cr-row"
              aria-labelledby={`cr-${row.id}-h`}
            >
              <DocumentLayout
                aside={
                  vm ? (
                    <div className="nk-grid">
                      <div className="nk-wrap">
                        <TicketCard
                          productId={row.id}
                          vm={vm}
                          name={vm.name}
                          partnerName={partnerNameOf(row.id, cards)}
                          showProvisional={showProvisional}
                        />
                      </div>
                    </div>
                  ) : undefined
                }
                asideFirst
                asideBare
              >
                <div className="nos-cr-main">
                  <h2 id={`cr-${row.id}-h`}>{row.heading}</h2>
                  <p data-conference-standfirst="" className="doc-standfirst">
                    {row.standfirst}
                  </p>
                  <p data-conference-body="" className="nos-cr-text">
                    {row.body}
                  </p>
                  <Link href={nosPath(row.href)} className="nos-cr-link">
                    {row.linkLabel} <span aria-hidden="true">&rarr;</span>
                  </Link>
                </div>
              </DocumentLayout>
            </section>
          );
        })}
      </div>
      <NosShowIndex current="/national-show/conferences" />
    </>
  );
}
