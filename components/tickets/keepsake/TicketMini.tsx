// The small ticket of the hero fan (goldens/f18b HANDOFF section 3.5 / mock `data-mini`): stub,
// date, name and price, and nothing to press: the whole ticket is one link (FanLink). It carries
// no id and no heading, so the full card of the same product stays the page's one target. Its stub
// is the product's own numeral and caption, never a show day (r45: the Day Pass names no day).

import { formatRand } from '@/components/nos/cheapest-admission';
import { TICKET_COPY, TICKET_PRODUCTS, type TicketProductId } from '@/lib/data/ticket-presentation';

import { TicketPrice, TicketStub } from './parts';
import type { KeepsakeCardVm } from './types';

export interface TicketMiniProps {
  productId: TicketProductId;
  vm: KeepsakeCardVm;
  name?: string | null;
}

export function TicketMini({ productId, vm, name: nameProp }: TicketMiniProps) {
  const product = TICKET_PRODUCTS[productId];
  const name = nameProp ?? vm.name ?? product.name;
  const muted = vm.state === 'soldOut' || vm.state === 'earlyBirdSoldOut';
  const closed = vm.state === 'salesClosed';
  const price = vm.state === 'pricePending' ? null : vm.price;

  return (
    <div data-ticket-mini="" data-ticket-state={vm.state} className="nk-ticket">
      <TicketStub
        product={product}
        numeral={product.numeral}
        caption={product.caption}
        admit={TICKET_COPY.admit}
        soldOut={vm.state === 'soldOut'}
      />
      <span className="nk-perf" aria-hidden="true" />
      <div className="nk-main">
        <p className="nk-when">{product.when}</p>
        <p className="nk-name">{faceName(name)}</p>
        <div className="nk-buy">
          {closed ? null : price === null ? (
            <div className="nk-pending">
              <span className="nk-price is-pending">{TICKET_COPY.pricePending}</span>
              <span className="nk-chip">{TICKET_COPY.chip}</span>
            </div>
          ) : (
            <div>
              <TicketPrice price={price} each={product.each} muted={muted} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** The accessible name of a fan link: "<name>, R<price>", ", price to follow" or ", sold out". */
// The fan face drops a trailing parenthetical (the full name stays in the link label and on
// the card below).
export function faceName(name: string): string {
  return name.replace(/\s*\([^)]*\)\s*$/, '');
}

export function fanLinkLabel(
  productId: TicketProductId,
  vm: KeepsakeCardVm,
  nameProp?: string | null
): string {
  const name = nameProp ?? vm.name ?? TICKET_PRODUCTS[productId].name;
  if (vm.state === 'salesClosed') return `${name}, ${TICKET_COPY.salesClosedLabel}`;
  if (vm.state === 'pricePending' || vm.price === null) return `${name}, price to follow`;
  if (vm.state === 'soldOut') return `${name}, sold out`;
  return `${name}, ${formatRand(vm.price)}`;
}
