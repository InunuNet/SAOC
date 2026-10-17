import type { Metadata } from 'next';

import { NosHero } from '@/components/nos/NosHero';
import { NosShowIndex } from '@/components/nos/NosShowIndex';
import { SalesStatusLine, TicketCard, TicketSection } from '@/components/tickets/keepsake';
import { loadTicketCardViewModels } from '@/lib/data/admission-availability';
import { TICKET_COPY, partnerNameOf, type TicketProductId } from '@/lib/data/ticket-presentation';
import { buildPageMetadata } from '@/lib/seo';
import { nosOgImage } from '@/app/(marketing)/national-show/og-image';

// Live stock reaches this page through Firebase Admin credentials that exist only at runtime,
// so it can never be prerendered at build time.
export const dynamic = 'force-dynamic';

// Description restates the page's own rendered lede below — no new claim is introduced here.
// Deliberately no Event markup: ticketType carries no session date, and inventing one to
// unlock a rich result is exactly what M6/B8d forbids.
export const metadata: Metadata = buildPageMetadata({
  title: 'Workshops & Field Trips — National Show',
  image: nosOgImage('Workshops & Field Trips — National Show'),
  description:
    'Book Sunset Cocktails and guided Field Trip outings at the South African National ' +
    'Orchid Show.',
  path: '/national-show/workshops',
});

const WORKSHOP_PAGE_PRODUCTS: readonly TicketProductId[] = ['sunset', 'workshops'];

export default async function WorkshopsFieldTripsTicketsPage() {
  const { cards, salesOpen } = await loadTicketCardViewModels();

  return (
    <>
      <NosHero
        route="/national-show/workshops"
        title="Workshops & Field Trips"
        lede="Book Sunset Cocktails and guided Field Trip outings at the National Show."
        priority
      />
      {!salesOpen ? <SalesStatusLine /> : null}
      <TicketSection id="programme" title={TICKET_COPY.sections.programme} columns={2}>
        {WORKSHOP_PAGE_PRODUCTS.map((id) => {
          const vm = cards[id];
          return vm ? (
            <div key={id} className="nk-wrap">
              <TicketCard
                productId={id}
                vm={vm}
                name={vm.name}
                partnerName={partnerNameOf(id, cards)}
              />
            </div>
          ) : null;
        })}
      </TicketSection>
      <NosShowIndex current="/national-show/workshops" currentTone="ink" />
    </>
  );
}
