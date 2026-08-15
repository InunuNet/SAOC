import type { Ticket } from '@/types/index';
import { StatusPill } from './StatusPill';

const HEADER_CELL_CLASS =
  'whitespace-nowrap border-b border-rule bg-bone px-4 py-3 text-left font-mono text-[11px] uppercase tracking-[0.16em] text-muted';
const BODY_CELL_CLASS = 'whitespace-nowrap border-b border-rule-soft px-4 py-3 font-sans text-[14px] text-ink';

interface TicketsTableProps {
  tickets: Ticket[];
}

function formatPurchasedAt(ticket: Ticket): string {
  return ticket.purchasedAt ? new Date(ticket.purchasedAt.toMillis()).toISOString() : '—';
}

export function TicketsTable({ tickets }: TicketsTableProps) {
  if (tickets.length === 0) {
    return (
      <div className="border border-rule bg-ivory px-6 py-16 text-center">
        <p className="font-sans text-[15px] text-muted">No tickets have been sold yet.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto border border-rule bg-ivory">
      <table className="w-full min-w-[720px] border-collapse">
        <caption className="sr-only">Ticket sales and check-in status</caption>
        <thead>
          <tr>
            <th scope="col" className={HEADER_CELL_CLASS}>
              Booking Ref
            </th>
            <th scope="col" className={HEADER_CELL_CLASS}>
              Attendee Name
            </th>
            <th scope="col" className={HEADER_CELL_CLASS}>
              Attendee Email
            </th>
            <th scope="col" className={HEADER_CELL_CLASS}>
              Ticket Type
            </th>
            <th scope="col" className={HEADER_CELL_CLASS}>
              Status
            </th>
            <th scope="col" className={HEADER_CELL_CLASS}>
              Purchased At
            </th>
          </tr>
        </thead>
        <tbody>
          {tickets.map((ticket) => (
            <tr key={ticket.id} className="hover:bg-parchment/60">
              <th scope="row" className={`${BODY_CELL_CLASS} tabular-nums font-medium`}>
                {ticket.bookingRef}
              </th>
              <td className={BODY_CELL_CLASS}>{ticket.attendeeName}</td>
              <td className={BODY_CELL_CLASS}>{ticket.attendeeEmail}</td>
              <td className={BODY_CELL_CLASS}>{ticket.ticketType}</td>
              <td className={BODY_CELL_CLASS}>
                <StatusPill status={ticket.status} />
              </td>
              <td className={`${BODY_CELL_CLASS} tabular-nums`}>{formatPurchasedAt(ticket)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
