'use client';

// One keepsake ticket for a product slot (goldens/f18b HANDOFF sections 2 and 3.1). It renders a
// view model and never re-derives its state: the server's `state` is final, and a higher state
// masks every slot a lower one would show. The Day Pass adds the day selector, whose chosen day
// drives the stub numeral and the checkout link.

import Link from 'next/link';
import { useId, useState } from 'react';

import { formatShowDayShort, showDayStub } from '@/lib/show-day-format';
import {
  TICKET_COPY,
  TICKET_DETAIL_HREFS,
  TICKET_PRODUCTS,
  type TicketProductId,
} from '@/lib/data/ticket-presentation';

import { BuyBlock } from './BuyBlock';
import { daySubline, firstSelectableDay, isDayClosed } from './days';
import { TicketCount, TicketStub } from './parts';
import type { KeepsakeCardVm, KeepsakeDay } from './types';

export interface TicketCardProps {
  productId: TicketProductId;
  vm: KeepsakeCardVm;
  // CMS ticket-type names (they win over the design's product names).
  name?: string | null;
  // The name of the pass an early-bird SKU shares its pool with.
  partnerName?: string | null;
  // The name of the regular SKU an early-bird SKU gives way to.
  regularName?: string | null;
}

interface DayPickerProps {
  groupName: string;
  days: KeepsakeDay[];
  chosen: string | null;
  onChoose: (day: string) => void;
}

function DayPicker({ groupName, days, chosen, onChoose }: DayPickerProps) {
  return (
    <fieldset className="nk-days">
      <legend>{TICKET_COPY.chooseDay}</legend>
      <div className="nk-days-row">
        {days.map((d) => {
          const closed = isDayClosed(d);
          const sub = daySubline(d);
          const classes = ['nk-day', closed ? 'is-out' : '', d.state === 'low' ? 'is-low' : '']
            .filter(Boolean)
            .join(' ');
          return (
            <label key={d.day} data-ticket-day="" data-state={d.state} className={classes}>
              <input
                type="radio"
                name={groupName}
                value={d.day}
                checked={chosen === d.day && !closed}
                disabled={closed}
                onChange={() => onChoose(d.day)}
              />
              <b>{formatShowDayShort(d.day)}</b>
              {sub ? <span>{sub}</span> : null}
              {d.state === 'low' ? <span className="nk-sub">{TICKET_COPY.fewLeft}</span> : null}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

export function TicketCard({
  productId,
  vm,
  name: nameProp,
  partnerName,
  regularName,
}: TicketCardProps) {
  const product = TICKET_PRODUCTS[productId];
  const name = nameProp ?? vm.name ?? product.name;
  const detailHref = TICKET_DETAIL_HREFS[productId];
  const groupName = useId();
  const [day, setDay] = useState<string | null>(() => firstSelectableDay(vm.days));

  const dayStub = vm.days ? showDayStub(day ?? vm.days[0]?.day ?? '') : null;
  const numeral = dayStub ? dayStub.numeral : product.numeral;
  const caption = dayStub ? dayStub.caption : product.caption;

  return (
    <article
      id={`ticket-${productId}`}
      data-ticket-card=""
      data-ticket-state={vm.state}
      data-ticket-slug={vm.slug}
      aria-label={name}
      className="nk-card"
    >
      {/* The drop-shadow filter lives on the article; the notch mask lives on the ticket inside it,
          because a filter on a masked element is itself cut by the mask. */}
      <div className="nk-ticket">
        <TicketStub
          product={product}
          numeral={numeral}
          caption={caption}
          admit={TICKET_COPY.admit}
          soldOut={vm.state === 'soldOut'}
        />
        <span className="nk-perf" aria-hidden="true" />
        <div data-ticket-body="" className="nk-main">
          <p className="nk-when">{product.when}</p>
          <h3 data-ticket-name="" className="nk-name">
            {detailHref ? <Link href={detailHref}>{name}</Link> : name}
          </h3>
          {product.theme ? <p className="nk-theme">{product.theme}</p> : null}
          {product.meta ? <p className="nk-meta">{product.meta}</p> : null}
          <TicketCount vm={vm} partner={partnerName ?? product.partner} />
          {vm.days ? (
            <DayPicker groupName={groupName} days={vm.days} chosen={day} onChoose={setDay} />
          ) : null}
          <BuyBlock
            vm={vm}
            name={name}
            product={product}
            day={day}
            regularName={regularName ?? vm.regularName ?? null}
          />
        </div>
      </div>
    </article>
  );
}
