import type { Metadata } from 'next';

import { NosHero } from '@/components/nos/NosHero';
import { NOS_ROUTE_HEROES } from '@/components/nos/nos-route-heroes';
import { NosShowIndex } from '@/components/nos/NosShowIndex';
import { SalesStatusLine, TicketCard, TicketSection } from '@/components/tickets/keepsake';
import { loadTicketCardViewModels } from '@/lib/data/admission-availability';
import { withholdPlaceholderProse } from '@/lib/data/show-pages';
import { TICKET_COPY, partnerNameOf, type TicketProductId } from '@/lib/data/ticket-presentation';
import { buildPageMetadata } from '@/lib/seo';
import { withTicketingTestTitle } from '@/lib/ticketing-test-metadata';
import { nosOgImage } from '@/app/(nos)/national-show/og-image';

// Live stock reaches this page through Firebase Admin credentials that exist only at runtime,
// so it can never be prerendered at build time.
export const dynamic = 'force-dynamic';

// Description restates the page's own rendered lede below — no new claim is introduced here.
// Deliberately no Event markup: ticketType carries no session date, and inventing one to
// unlock a rich result is exactly what M6/B8d forbids.
export const metadata: Metadata = withTicketingTestTitle(
  buildPageMetadata({
    title: NOS_ROUTE_HEROES.conferences.title,
    image: nosOgImage('Conferences — National Show'),
    description:
      // prettier-ignore
      'Register for the National Orchid Show Symposium or the WOSA Conference at the South African National Orchid Show.',
    path: '/national-show/conferences',
  })
);

const CONFERENCE_PRODUCTS: readonly TicketProductId[] = ['symposium', 'wosa'];

export default async function ConferencesTicketsPage() {
  const { cards, salesOpen } = await loadTicketCardViewModels();
  const showProvisional = !withholdPlaceholderProse();

  return (
    <>
      <NosHero
        route={NOS_ROUTE_HEROES.conferences.route}
        title={NOS_ROUTE_HEROES.conferences.title}
        lede={NOS_ROUTE_HEROES.conferences.lede}
        priority
      />
      {!salesOpen ? <SalesStatusLine /> : null}
      <TicketSection id="programme" title={TICKET_COPY.sections.programme} columns={2}>
        {CONFERENCE_PRODUCTS.map((id) => {
          const vm = cards[id];
          return vm ? (
            <div key={id} className="nk-wrap">
              <TicketCard
                productId={id}
                vm={vm}
                name={vm.name}
                partnerName={partnerNameOf(id, cards)}
                showProvisional={showProvisional}
              />
            </div>
          ) : null;
        })}
      </TicketSection>
      <NosShowIndex current="/national-show/conferences" currentTone="ink" />
    </>
  );
}
