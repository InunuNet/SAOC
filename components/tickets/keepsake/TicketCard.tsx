'use client';

// One keepsake ticket for a product slot (goldens/f18b HANDOFF sections 2 and 3.1). It renders a
// view model and never re-derives its state: the server's `state` is final, and a higher state
// masks every slot a lower one would show. The Day Pass adds the day selector, whose chosen day
// drives the stub numeral and the checkout link.

import { useId, useState } from 'react';

import { formatShowDayShort, showDayStub } from '@/lib/show-day-format';
import {
  TICKET_COPY,
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

export function TicketCard({ productId, vm }: TicketCardProps) {
  const product = TICKET_PRODUCTS[productId];
  const name = vm.name ?? product.name;
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
      aria-label={name}
      className="nk-ticket"
    >
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
          {name}
        </h3>
        {product.theme ? <p className="nk-theme">{product.theme}</p> : null}
        {product.meta ? <p className="nk-meta">{product.meta}</p> : null}
        <TicketCount vm={vm} partner={product.partner} />
        {vm.days ? (
          <DayPicker groupName={groupName} days={vm.days} chosen={day} onChoose={setDay} />
        ) : null}
        <BuyBlock vm={vm} name={name} product={product} day={day} />
      </div>
    </article>
  );
}
