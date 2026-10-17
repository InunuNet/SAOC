// The hero fan (goldens/f18b HANDOFF section 3.5): the four headline tickets, VIP, Sunset
// Cocktails, Weekend Pass and Day Pass, fanned on one arc from 701px up and a 2x2 deck below. A
// product with no card (its ticket type is not in the CMS) is left out, never invented.

import { TICKET_FAN_ORDER, type TicketProductId } from '@/lib/data/ticket-presentation';

import { FanLink } from './FanLink';
import { TicketMini, fanLinkLabel } from './TicketMini';
import type { KeepsakeCardVm } from './types';

export interface TicketFanProps {
  cards: Partial<Record<TicketProductId, KeepsakeCardVm>>;
}

export function TicketFan({ cards }: TicketFanProps) {
  return (
    <div data-nos-ticket-fan="" className="nk-fan">
      {TICKET_FAN_ORDER.map((id) => {
        const vm = cards[id];
        if (!vm) return null;
        return (
          <div key={id} className="nk-wrap">
            <FanLink targetId={`ticket-${id}`} label={fanLinkLabel(id, vm)}>
              <TicketMini productId={id} vm={vm} />
            </FanLink>
          </div>
        );
      })}
    </div>
  );
}
