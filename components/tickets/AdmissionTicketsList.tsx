// F2 (ticketing-flow-redesign, M2) — vertical menu of Admission ticket-type cards, each
// linking to its own dedicated buy screen (`/tickets/[slug]`). Purely presentational: no
// quantity stepper, no attendee fields, no submit button. Server-renderable — no hooks, no
// browser APIs. See contracts/golden/ticketing-flow-redesign-f2/dedicated-screen.golden.md.
import { TicketTypeCard, type TicketTypeCardData } from '@/components/tickets/TicketTypeCard';

interface AdmissionTicketsListProps {
  ticketTypes: TicketTypeCardData[];
  soldOutLabel: string;
}

export function AdmissionTicketsList({ ticketTypes, soldOutLabel }: AdmissionTicketsListProps) {
  return (
    <div className="flex flex-col gap-6">
      {ticketTypes.map((t) => (
        <TicketTypeCard key={t.slug} ticketType={t} mode="list" soldOutLabel={soldOutLabel} />
      ))}
    </div>
  );
}
