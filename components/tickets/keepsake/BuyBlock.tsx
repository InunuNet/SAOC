'use client';

// The buy row of one keepsake ticket (goldens/f18b HANDOFF section 3.1): price, stepper and the
// one CTA, or the words of the state that mask them. A higher state hides every slot a lower one
// would show, and a ticket that is not on sale carries no button at all. The CTA is a plain link
// to the checkout screen, so quantity (and the chosen day) travel in the URL: checkout owns the
// real limits and the stepper here is presentational.

import Link from 'next/link';
import { useState } from 'react';

import { formatRand } from '@/components/nos/cheapest-admission';
import { TICKET_COPY, type TicketProduct } from '@/lib/data/ticket-presentation';

import { ArrowIcon, MinusIcon, PlusIcon, TicketPrice } from './parts';
import type { KeepsakeCardVm } from './types';

const MIN_QUANTITY = 1;
const MAX_QUANTITY = 10;
const SESSIONS_HREF = '#sessions';

interface BuyBlockProps {
  vm: KeepsakeCardVm;
  /** The name the stepper group is labelled with. */
  name: string;
  product: TicketProduct;
  /** Per-session cards price each place and link their own session ticket type. */
  session?: boolean;
  /** The chosen day (Day Pass only), appended to the checkout link. */
  day?: string | null;
}

function checkoutHref(slug: string, quantity: number, day: string | null | undefined): string {
  const query = new URLSearchParams({ quantity: String(quantity) });
  if (day) query.set('day', day);
  return `/tickets/${slug}?${query.toString()}`;
}

export function BuyBlock({ vm, name, product, session = false, day = null }: BuyBlockProps) {
  const [quantity, setQuantity] = useState(MIN_QUANTITY);

  if (vm.state === 'pricePending' || vm.price === null) {
    return (
      <div className="nk-buy">
        <div className="nk-pending">
          <span className="nk-price is-pending">{TICKET_COPY.pricePending}</span>
          <span className="nk-chip">{TICKET_COPY.chip}</span>
          <p className="nk-note">{TICKET_COPY.pendingNote}</p>
        </div>
      </div>
    );
  }

  const each = product.each;
  if (vm.state === 'earlyBirdSoldOut') {
    return (
      <div className="nk-buy">
        <div>
          <TicketPrice price={vm.price} each={each} muted />
          <p className="nk-was">
            <s>{TICKET_COPY.earlyBirdPriceStruck}</s>
            {` ${TICKET_COPY.earlyBirdSoldOut}`}
          </p>
          {vm.regularPrice !== null ? (
            <p className="nk-was">{`The ${product.name} is now ${formatRand(vm.regularPrice)}.`}</p>
          ) : null}
        </div>
      </div>
    );
  }

  if (vm.state === 'soldOut') {
    return (
      <div className="nk-buy">
        <div>
          <TicketPrice price={vm.price} each={each} muted />
          <p className="nk-was">{TICKET_COPY.soldOutLine}</p>
        </div>
      </div>
    );
  }

  if (product.kind === 'workshop' && !session) {
    return (
      <div className="nk-buy">
        <div>
          <TicketPrice price={vm.price} each={each} muted={false} />
        </div>
        <a data-ticket-cta="" className="nk-btn nk-cta" href={SESSIONS_HREF}>
          {TICKET_COPY.chooseSession}
          <ArrowIcon />
        </a>
      </div>
    );
  }

  const isPass = product.kind === 'pass';
  const scarcity = vm.scarcity;
  const max =
    !isPass && scarcity
      ? Math.max(MIN_QUANTITY, Math.min(MAX_QUANTITY, scarcity.remaining))
      : MAX_QUANTITY;
  const current = Math.min(quantity, max);
  const earlyBirdLine =
    isPass && vm.slug.endsWith('early-bird')
      ? vm.regularPrice !== null
        ? `Early-bird ${formatRand(vm.price)}, then ${formatRand(vm.regularPrice)}`
        : TICKET_COPY.earlyBirdPriceStruck
      : null;

  return (
    <div className="nk-buy">
      <div>
        <TicketPrice price={vm.price} each={each} muted={false} />
        {earlyBirdLine ? <p className="nk-was">{earlyBirdLine}</p> : null}
      </div>
      <div
        data-ticket-stepper=""
        data-max={max}
        className="nk-stepper"
        role="group"
        aria-label={`${name} ${TICKET_COPY.stepperLabelSuffix}`}
      >
        <button
          type="button"
          aria-label={TICKET_COPY.fewer}
          disabled={current <= MIN_QUANTITY}
          onClick={() => setQuantity(Math.max(MIN_QUANTITY, current - 1))}
        >
          <MinusIcon />
        </button>
        <output aria-live="polite">{current}</output>
        <button
          type="button"
          aria-label={TICKET_COPY.more}
          disabled={current >= max}
          onClick={() => setQuantity(Math.min(max, current + 1))}
        >
          <PlusIcon />
        </button>
      </div>
      <Link data-ticket-cta="" className="nk-btn nk-cta" href={checkoutHref(vm.slug, current, day)}>
        {TICKET_COPY.buy}
        <ArrowIcon />
      </Link>
    </div>
  );
}
