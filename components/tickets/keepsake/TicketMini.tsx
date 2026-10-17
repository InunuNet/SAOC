// The small ticket of the hero fan (goldens/f18b HANDOFF section 3.5 / mock `data-mini`): stub,
// date, name and price, and nothing to press: the whole ticket is one link (FanLink). It carries
// no id and no heading, so the full card of the same product stays the page's one target.

import { formatRand } from '@/components/nos/cheapest-admission';
import { showDayStub } from '@/lib/show-day-format';
import { TICKET_COPY, TICKET_PRODUCTS, type TicketProductId } from '@/lib/data/ticket-presentation';

import { firstSelectableDay } from './days';
import { TicketPrice, TicketStub } from './parts';
import type { KeepsakeCardVm } from './types';

export interface TicketMiniProps {
  productId: TicketProductId;
  vm: KeepsakeCardVm;
}

export function TicketMini({ productId, vm }: TicketMiniProps) {
  const product = TICKET_PRODUCTS[productId];
  const name = vm.name ?? product.name;
  const dayStub = vm.days ? showDayStub(firstSelectableDay(vm.days) ?? vm.days[0]?.day ?? '') : null;
  const muted = vm.state === 'soldOut' || vm.state === 'earlyBirdSoldOut';

  return (
    <div data-ticket-mini="" data-ticket-state={vm.state} className="nk-ticket">
      <TicketStub
        product={product}
        numeral={dayStub ? dayStub.numeral : product.numeral}
        caption={dayStub ? dayStub.caption : product.caption}
        admit={TICKET_COPY.admit}
        soldOut={vm.state === 'soldOut'}
      />
      <span className="nk-perf" aria-hidden="true" />
      <div className="nk-main">
        <p className="nk-when">{product.when}</p>
        <p className="nk-name">{name}</p>
        <div className="nk-buy">
          {vm.state === 'pricePending' || vm.price === null ? (
            <div className="nk-pending">
              <span className="nk-price is-pending">{TICKET_COPY.pricePending}</span>
              <span className="nk-chip">{TICKET_COPY.chip}</span>
            </div>
          ) : (
            <div>
              <TicketPrice price={vm.price} each={product.each} muted={muted} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** The accessible name of a fan link: "<name>, R<price>", ", price to follow" or ", sold out". */
export function fanLinkLabel(productId: TicketProductId, vm: KeepsakeCardVm): string {
  const name = vm.name ?? TICKET_PRODUCTS[productId].name;
  if (vm.state === 'pricePending' || vm.price === null) return `${name}, price to follow`;
  if (vm.state === 'soldOut') return `${name}, sold out`;
  return `${name}, ${formatRand(vm.price)}`;
}
