// =============================================================
// NOS — components/show/AdmissionPriceList.tsx
// Server Component — the admission products and their prices, worded exactly as the tickets hub's
// fan links word them (fanLinkLabel over TICKET_FAN_ORDER) and read from the same view models
// (loadTicketCardViewModels). The FAQ cost row and the what-to-expect Admission card both draw it,
// so a price can never read differently from the tickets page (R7: no price is typed here).
// =============================================================

import { fanLinkLabel } from '@/components/tickets/keepsake/TicketMini';
import type { TicketCard } from '@/lib/data/ticket-card-view-models';
import { TICKET_FAN_ORDER, type TicketProductId } from '@/lib/data/ticket-presentation';

type AdmissionCards = Partial<Record<TicketProductId, TicketCard>>;

/** One label per admission product that has a price to show; the hub fan names the same ones. */
export function admissionPriceLabels(cards: AdmissionCards): string[] {
  return TICKET_FAN_ORDER.flatMap((id) => {
    const vm = cards[id];
    if (!vm || vm.price === null) return [];
    if (vm.state === 'salesClosed' || vm.state === 'pricePending' || vm.state === 'soldOut') {
      return [];
    }
    return [fanLinkLabel(id, vm)];
  });
}

export function AdmissionPriceList({ cards }: { cards: AdmissionCards }) {
  const labels = admissionPriceLabels(cards);
  if (labels.length === 0) return null;
  return (
    <ul
      data-admission-prices=""
      className="mt-3 space-y-1 font-sans text-[16px] leading-[1.55] text-ink/80"
    >
      {labels.map((label) => (
        <li key={label}>{label}</li>
      ))}
    </ul>
  );
}
