import type { Metadata } from 'next';

import { NosHero } from '@/components/nos/NosHero';
import { NosSection } from '@/components/nos/NosSection';
import { NosShowIndex } from '@/components/nos/NosShowIndex';
import { ShowStatusLine } from '@/components/show/ShowStatusLine';
import { SalesStatusLine, TicketCard, TicketSection } from '@/components/tickets/keepsake';
import { loadTicketCardViewModels } from '@/lib/data/admission-availability';
import { withholdPlaceholderProse } from '@/lib/data/show-pages';
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

const SESSIONS_NOTE =
  'Individual session times are still being finalised — the products below are the ' +
  'sellable Sunset Cocktails and Field Trip options. Per-session bookings are not yet ' +
  'available for purchase.';
// Its first sentence is the disclosure body and its second the foot line (the wording is unchanged).
const [SESSIONS_NOTE_BODY, SESSIONS_NOTE_FOOT] = SESSIONS_NOTE.match(/[^.]+\./g) ?? [
  SESSIONS_NOTE,
  '',
];
const SESSIONS_NOTE_CHIP = 'To be confirmed by the show committee';

const WORKSHOP_PAGE_PRODUCTS: readonly TicketProductId[] = ['sunset', 'workshops'];

export default async function WorkshopsFieldTripsTicketsPage() {
  const { cards, salesOpen } = await loadTicketCardViewModels();
  const showProvisional = !withholdPlaceholderProse();

  return (
    <>
      <NosHero
        route="/national-show/workshops"
        title="Workshops & Field Trips"
        lede="Book Sunset Cocktails and guided Field Trip outings at the National Show."
        priority
      />
      <NosSection>
        <div className="nk-sessions-note">
          <ShowStatusLine
            status="pending"
            pendingLabel={SESSIONS_NOTE_CHIP}
            items={[SESSIONS_NOTE_BODY.trim().replace(/\.$/, '')]}
            foot={SESSIONS_NOTE_FOOT.trim()}
          />
        </div>
      </NosSection>
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
                showProvisional={showProvisional}
              />
            </div>
          ) : null;
        })}
      </TicketSection>
      <NosShowIndex current="/national-show/workshops" currentTone="ink" />
    </>
  );
}
