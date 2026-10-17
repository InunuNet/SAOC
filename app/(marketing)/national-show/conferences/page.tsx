import type { Metadata } from 'next';

import { NosHero } from '@/components/nos/NosHero';
import { NosShowIndex } from '@/components/nos/NosShowIndex';
import { SalesStatusLine, TicketCard, TicketSection } from '@/components/tickets/keepsake';
import { loadTicketCardViewModels } from '@/lib/data/admission-availability';
import { withholdPlaceholderProse } from '@/lib/data/show-pages';
import { countDisplay } from '@/lib/data/ticket-count-display';
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
  title: 'Conferences — National Show',
  image: nosOgImage('Conferences — National Show'),
  description:
    // prettier-ignore
    'Register for the National Orchid Show Symposium or the WOSA Conference at the South African National Orchid Show.',
  path: '/national-show/conferences',
});

const CONFERENCE_PRODUCTS: readonly TicketProductId[] = ['symposium', 'wosa'];

export default async function ConferencesTicketsPage() {
  const { cards, salesOpen, provisionalTotals } = await loadTicketCardViewModels();
  const withhold = withholdPlaceholderProse();

  return (
    <>
      <NosHero
        route="/national-show/conferences"
        title="Conferences"
        lede="Register for the National Orchid Show Symposium or the WOSA Conference."
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
                counts={countDisplay(provisionalTotals.bySlug[vm.slug] === true, withhold)}
                dayCounts={countDisplay(provisionalTotals.day, withhold)}
              />
            </div>
          ) : null;
        })}
      </TicketSection>
      <NosShowIndex current="/national-show/conferences" currentTone="ink" />
    </>
  );
}
