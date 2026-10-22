'use client';

// One keepsake ticket for a product slot (goldens/f18b HANDOFF sections 2 and 3.1). It renders a
// view model and never re-derives its state: the server's `state` is final, and a higher state
// masks every slot a lower one would show. The Day Pass adds the day selector, whose chosen day
// drives the stub numeral and the checkout link. No day is chosen until the buyer picks one (r45):
// the stub stays the product's own, and Buy with no day shows the picker's required-field error.

import Link from 'next/link';
import { useEffect, useId, useRef, useState, type RefObject } from 'react';

import { TicketFieldAlert } from '@/components/tickets/TicketFormField';
import { formatShowDayShort, showDayStub } from '@/lib/show-day-format';
import {
  TICKET_COPY,
  TICKET_DETAIL_HREFS,
  TICKET_PRODUCTS,
  type TicketProductId,
} from '@/lib/data/ticket-presentation';

import { BuyBlock } from './BuyBlock';
import { CHECKOUT_DAY_EVENT } from './checkout-day';
import { countDisplay, daySubline, isDayClosed } from './days';
import { TicketCount, TicketPrice, TicketStub } from './parts';
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
  // Beta preview: counts from provisional totals show, marked "Not yet confirmed". Public: hidden.
  showProvisional?: boolean;
  // `summary` is the checkout page's read-only card: the same stub, name, when-line and price,
  // with no stepper, no day picker and no button.
  variant?: 'default' | 'summary';
  // Summary only: the day the checkout opened on (it follows the form's day choice), and
  // whether the price is provisional (its note sits under the price).
  day?: string | null;
  provisionalPrice?: boolean;
  /** Name element; card lists under a section h2 keep the default h3, the checkout summary opts into p (its name repeats the page h1, r18). */
  headingLevel?: 'h3' | 'p';
}

interface DayPickerProps {
  groupName: string;
  groupRef: RefObject<HTMLFieldSetElement | null>;
  days: KeepsakeDay[];
  chosen: string | null;
  onChoose: (day: string) => void;
  showProvisional: boolean;
  // Buy was pressed with no day chosen: the checkout forms' required-field error, in the picker's label.
  invalid: boolean;
}

function DayPicker({
  groupName,
  groupRef,
  days,
  chosen,
  onChoose,
  showProvisional,
  invalid,
}: DayPickerProps) {
  return (
    <fieldset ref={groupRef} className="nk-days" aria-invalid={invalid}>
      <legend>{TICKET_COPY.chooseDay}</legend>
      <div className="nk-days-row">
        {days.map((d) => {
          const closed = isDayClosed(d);
          const counts = countDisplay(d.provisional, showProvisional);
          const sub = daySubline(d, counts);
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
              {sub && d.remaining !== null && sub === `${d.remaining} of ${d.total}` ? (
                <span data-placeholder={counts === 'placeholder' ? 'true' : undefined}>
                  <span className="nk-of">{sub}</span>
                  <span className="nk-left">{`${d.remaining} left`}</span>
                </span>
              ) : sub ? (
                <span data-placeholder={counts === 'placeholder' ? 'true' : undefined}>{sub}</span>
              ) : null}
              {d.state === 'low' ? <span className="nk-sub">{TICKET_COPY.fewLeft}</span> : null}
            </label>
          );
        })}
      </div>
      {invalid ? <TicketFieldAlert spaced>{TICKET_COPY.chooseDay}</TicketFieldAlert> : null}
      {showProvisional && days.some((d) => d.provisional && daySubline(d, 'placeholder')) ? (
        <p className="nk-unconfirmed">{TICKET_COPY.notYetConfirmed}</p>
      ) : null}
    </fieldset>
  );
}

export function TicketCard({
  productId,
  vm,
  name: nameProp,
  partnerName,
  regularName,
  showProvisional = false,
  variant = 'default',
  day: summaryDay = null,
  provisionalPrice = false,
  headingLevel = 'h3',
}: TicketCardProps) {
  const NameHeading = headingLevel;
  const product = TICKET_PRODUCTS[productId];
  const name = nameProp ?? vm.name ?? product.name;
  const detailHref = TICKET_DETAIL_HREFS[productId];
  const groupName = useId();
  const summary = variant === 'summary';
  const [day, setDay] = useState<string | null>(summary ? summaryDay : null);
  const [dayMissing, setDayMissing] = useState(false);
  const pickerRef = useRef<HTMLFieldSetElement>(null);

  useEffect(() => {
    if (!summary) return undefined;
    function follow(event: Event) {
      setDay((event as CustomEvent<string>).detail);
    }
    window.addEventListener(CHECKOUT_DAY_EVENT, follow);
    return () => window.removeEventListener(CHECKOUT_DAY_EVENT, follow);
  }, [summary]);

  const dayStub = day ? showDayStub(day) : null;
  const numeral = dayStub ? dayStub.numeral : product.numeral;
  const caption = dayStub ? dayStub.caption : product.caption;

  // Buy with no day chosen stays a live button: it shows the picker's error and moves focus to the
  // first day the buyer can choose.
  function showDayMissing() {
    setDayMissing(true);
    pickerRef.current?.querySelector<HTMLInputElement>('input:not(:disabled)')?.focus();
  }

  return (
    <article
      id={`ticket-${productId}`}
      data-ticket-card=""
      data-ticket-variant={summary ? 'summary' : undefined}
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
          <NameHeading data-ticket-name="" className="nk-name">
            {detailHref && !summary ? <Link href={detailHref}>{name}</Link> : name}
          </NameHeading>
          {product.theme && !summary ? <p className="nk-theme">{product.theme}</p> : null}
          {product.meta && !summary ? <p className="nk-meta">{product.meta}</p> : null}
          {summary ? (
            <div className="nk-summary-price">
              {vm.price !== null ? (
                <TicketPrice price={vm.price} each={product.each} muted={false} />
              ) : null}
              {provisionalPrice ? (
                <p className="nk-provisional">{TICKET_COPY.provisionalPricing}</p>
              ) : null}
            </div>
          ) : (
            <>
              <TicketCount
                vm={vm}
                partner={partnerName ?? product.partner}
                counts={countDisplay(vm.scarcity?.provisional, showProvisional)}
              />
              {vm.days ? (
                <DayPicker
                  groupName={groupName}
                  groupRef={pickerRef}
                  days={vm.days}
                  chosen={day}
                  onChoose={setDay}
                  showProvisional={showProvisional}
                  invalid={dayMissing && day === null}
                />
              ) : null}
              <BuyBlock
                vm={vm}
                name={name}
                product={product}
                day={day}
                regularName={regularName ?? vm.regularName ?? null}
                onMissingDay={vm.days ? showDayMissing : undefined}
              />
            </>
          )}
        </div>
      </div>
    </article>
  );
}
