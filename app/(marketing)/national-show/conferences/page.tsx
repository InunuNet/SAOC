import type { Metadata } from 'next';

import { ConfirmationBadge } from '@/components/show';
import { NosHero } from '@/components/nos/NosHero';
import { NosShowIndex } from '@/components/nos/NosShowIndex';
import { SalesClosedNotice } from '@/components/tickets';
import { TicketCard, TicketSection } from '@/components/tickets/keepsake';
import { loadTicketCardViewModels } from '@/lib/data/admission-availability';
import { TICKET_COPY, type TicketProductId } from '@/lib/data/ticket-presentation';
import { sanityFetch } from '@/sanity/lib/fetch';
import { nationalShowSalesQuery } from '@/sanity/queries';
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
    'Register for the SAOC Symposium, the WOSA Conference, or the combined SAOC/WOSA Joint ' +
    'track at the South African National Orchid Show.',
  path: '/national-show/conferences',
});

const CONFERENCE_PRODUCTS: readonly TicketProductId[] = ['symposium', 'wosa'];

interface SalesState {
  salesOpen?: boolean | null;
}

export default async function ConferencesTicketsPage() {
  const [{ cards }, salesState] = await Promise.all([
    loadTicketCardViewModels(),
    sanityFetch<SalesState>({ query: nationalShowSalesQuery, tags: ['nationalShow', 'sanity'] }),
  ]);
  const salesOpen = salesState?.salesOpen === true;

  return (
    <>
      <NosHero
        route="/national-show/conferences"
        title="Conferences"
        lede="Register for the SAOC Symposium, the WOSA Conference, or the combined SAOC/WOSA Joint track at the National Show."
        priority
      />
      <TicketSection
        id="programme"
        title={TICKET_COPY.sections.programme}
        columns={2}
        lead={
          <div className="nos-surface nk-lead">
            <ConfirmationBadge status="pending" />
            {!salesOpen ? (
              <SalesClosedNotice message="Ticket sales are not yet open — check back soon." />
            ) : null}
          </div>
        }
      >
        {CONFERENCE_PRODUCTS.map((id) => {
          const vm = cards[id];
          return vm ? (
            <div key={id} className="nk-wrap">
              <TicketCard productId={id} vm={vm} />
            </div>
          ) : null;
        })}
      </TicketSection>
      <NosShowIndex current="/national-show/conferences" currentTone="ink" />
    </>
  );
}
