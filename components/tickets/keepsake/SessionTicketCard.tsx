'use client';

// One workshop session as a keepsake ticket (goldens/f18b HANDOFF section 3.7): a ticket with a
// 150px stub. Every null case reads as the design says: no time slot says "Time to be
// announced", no ticket type says booking is not open and carries no button. The stub numeral
// is the session's real place count, or the word "Workshop" when there is none.

import { TICKET_COPY, TICKET_PRODUCTS } from '@/lib/data/ticket-presentation';

import { BuyBlock } from './BuyBlock';
import { TicketCount, TicketStub } from './parts';
import type { KeepsakeSessionVm } from './types';

export interface SessionTicketCardProps {
  session: KeepsakeSessionVm;
  /** The presenter's name, resolved by the page from `session.presenterId`. */
  presenterName?: string | null;
}

const product = TICKET_PRODUCTS.workshops;

export function SessionTicketCard({ session, presenterName = null }: SessionTicketCardProps) {
  const card = session.ticketCard;
  const places = card?.scarcity ? String(card.scarcity.total) : '';
  const state = card ? card.state : 'none';

  return (
    <article
      data-ticket-card=""
      data-ticket-session=""
      data-ticket-state={state}
      aria-label={session.title}
      className="nk-ticket is-session"
    >
      <TicketStub
        product={product}
        numeral={places}
        caption={places ? TICKET_COPY.places : TICKET_COPY.workshopStubCaption}
        admit={TICKET_COPY.admitSession}
        soldOut={card?.state === 'soldOut'}
      />
      <span className="nk-perf" aria-hidden="true" />
      <div data-ticket-body="" className="nk-main">
        <p className="nk-when">{session.timeSlot ?? TICKET_COPY.timeTba}</p>
        <h3 data-ticket-name="" className="nk-name">
          {session.title}
        </h3>
        {session.description ? <p className="nk-meta">{session.description}</p> : null}
        {presenterName ? (
          <p className="nk-theme">{`${TICKET_COPY.presenterWith} ${presenterName}`}</p>
        ) : null}
        {card ? <TicketCount vm={card} partner={null} /> : null}
        {card ? (
          <BuyBlock vm={card} name={session.title} product={product} session />
        ) : (
          <div className="nk-buy">
            <p className="nk-note">{TICKET_COPY.sessionNotOpen}</p>
          </div>
        )}
      </div>
    </article>
  );
}
