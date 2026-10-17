// The one page-level status line shown while ticket sales are closed (design-cb ruling): the cards
// still render, masked, and this line says why. It carries the two existing strings only, the
// "Sales closed" label and the "Be the first to know" link to the council's contact page.

import Link from 'next/link';

import { TICKET_COPY } from '@/lib/data/ticket-presentation';

const CONTACT_HREF = '/contact';

export function SalesClosedStatus() {
  return (
    <div data-nos-wrap="" className="nk-status-wrap">
      <p data-sales-status="" role="status" className="nk-status">
        <strong>{TICKET_COPY.salesClosedLabel}</strong>
        <Link href={CONTACT_HREF}>{TICKET_COPY.salesClosedLink}</Link>
      </p>
    </div>
  );
}
