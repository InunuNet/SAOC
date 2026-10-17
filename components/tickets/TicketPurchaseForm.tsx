'use client';

import { useRef, useState } from 'react';

import { formatRand } from '@/components/nos/cheapest-admission';
import { CartAttendeeFields } from '@/components/tickets/CartAttendeeFields';
import { CheckoutRedirectNotice } from '@/components/tickets/CheckoutRedirectNotice';
import { OzowSandboxTestModeBanner } from '@/components/tickets/OzowSandboxTestModeBanner';
import type { TicketTypeCardData } from '@/components/tickets/TicketTypeCard';
import { useTicketCart } from '@/components/tickets/useTicketCart';
import { ArrowIcon } from '@/components/tickets/keepsake/parts';
import { CHECKOUT_DAY_EVENT } from '@/components/tickets/keepsake/checkout-day';
import { CART_MAX_LINE_ITEMS } from '@/lib/cart';
import { TICKET_COPY } from '@/lib/data/ticket-presentation';
import { formatShowDay } from '@/lib/show-day-format';

// The CTA stays enabled at quantity 0; a click there fills the hint and moves focus to it.
const BUY_HINT_ID = 'ticket-buy-hint';
const MIN_QUANTITY = 1;
const DAY_GROUP = 'checkout-day';

interface TicketPurchaseFormProps {
  ticketTypes: TicketTypeCardData[];
  showDays: string[];
  // A hub card's "Buy ticket" link opens the screen with its quantity (and day) chosen.
  initialQuantity?: number;
  initialDay?: string | null;
  // True only for a verified admin viewer (resolved server-side); the Ozow test-mode strip is
  // never public.
  showTestModeBanner?: boolean;
}

function startQuantity(requested: number | undefined): number {
  if (requested === undefined || !Number.isFinite(requested)) return MIN_QUANTITY;
  return Math.min(CART_MAX_LINE_ITEMS, Math.max(MIN_QUANTITY, Math.trunc(requested)));
}

// A day product opens on the day the link named, else on the first show day.
function startDay(
  type: TicketTypeCardData,
  showDays: string[],
  requested: string | null | undefined
): string | null {
  if (!type.requiresDaySelection) return null;
  return requested && showDays.includes(requested) ? requested : (showDays[0] ?? null);
}

export function TicketPurchaseForm({
  ticketTypes,
  showDays,
  initialQuantity,
  initialDay,
  showTestModeBanner = false,
}: TicketPurchaseFormProps) {
  const ticketType = ticketTypes[0];
  const cart = useTicketCart(ticketType, {
    quantity: startQuantity(initialQuantity),
    day: startDay(ticketType, showDays, initialDay),
  });
  const hintRef = useRef<HTMLParagraphElement>(null);
  const [hintRequested, setHintRequested] = useState(false);
  const hintVisible = hintRequested && cart.quantity < MIN_QUANTITY;

  if (cart.redirect) {
    return (
      <CheckoutRedirectNotice
        processUrl={cart.redirect.processUrl}
        fields={cart.redirect.fields}
        amount={cart.redirect.amount}
        providerId={cart.redirect.providerId}
      />
    );
  }

  function chooseDay(day: string) {
    cart.setDay(day);
    window.dispatchEvent(new CustomEvent(CHECKOUT_DAY_EVENT, { detail: day }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (cart.quantity < MIN_QUANTITY) {
      setHintRequested(true);
      hintRef.current?.focus();
      return;
    }
    void cart.submit();
  }

  const submitting = cart.status === 'submitting';

  return (
    <form
      onSubmit={handleSubmit}
      className="nk-checkout grid gap-3"
      noValidate
      data-nos-ticket-form=""
    >
      {showTestModeBanner ? <OzowSandboxTestModeBanner /> : null}

      {ticketType.requiresDaySelection ? (
        <fieldset className="days nk-days">
          <legend>{TICKET_COPY.chooseDay}</legend>
          <div className="nk-days-row">
            {showDays.map((day) => (
              <label key={day} className="nk-day">
                <input
                  type="radio"
                  name={DAY_GROUP}
                  value={day}
                  checked={cart.day === day}
                  disabled={submitting}
                  onChange={() => chooseDay(day)}
                />
                <b>
                  <time dateTime={day}>{formatShowDay(day)}</time>
                </b>
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}

      <div
        className="nk-qty"
        role="group"
        aria-label={`${ticketType.name} ${TICKET_COPY.stepperLabelSuffix}`}
      >
        <button
          type="button"
          aria-label={TICKET_COPY.fewer}
          disabled={submitting || cart.quantity <= MIN_QUANTITY}
          onClick={() => cart.setQuantity(cart.quantity - 1)}
        >
          −
        </button>
        <input
          id="ticket-quantity"
          type="number"
          inputMode="numeric"
          min={MIN_QUANTITY}
          max={CART_MAX_LINE_ITEMS}
          step={1}
          value={cart.quantity}
          disabled={submitting}
          aria-label={`${ticketType.name} ${TICKET_COPY.stepperLabelSuffix}`}
          onChange={(e) => {
            const parsed = Number.parseInt(e.target.value, 10);
            cart.setQuantity(Number.isNaN(parsed) ? 0 : parsed);
          }}
        />
        <button
          type="button"
          aria-label={TICKET_COPY.more}
          disabled={submitting || cart.quantity >= CART_MAX_LINE_ITEMS}
          onClick={() => cart.setQuantity(cart.quantity + 1)}
        >
          +
        </button>
      </div>

      <CartAttendeeFields
        ticketTypes={ticketTypes}
        quantities={{ [ticketType.slug]: cart.quantity }}
        attendeesByType={{ [ticketType.slug]: cart.attendees }}
        errors={cart.attendeeErrors}
        disabled={submitting}
        onAttendeeChange={cart.updateAttendeeField}
      />

      {cart.status === 'error' && cart.errorMessage ? (
        <p
          role="alert"
          className="border border-primary-800 bg-bone px-4 py-3 font-sans text-[14px] text-primary-800"
        >
          {cart.errorMessage}
        </p>
      ) : null}

      <div
        data-catalogue-total=""
        aria-live="polite"
        aria-atomic="true"
        className="nk-checkout-total"
      >
        <p>
          Total <strong>{formatRand(cart.estimatedTotal)}</strong>
        </p>
        <button
          type="submit"
          className="nk-btn nk-cta"
          disabled={submitting}
          aria-describedby={BUY_HINT_ID}
        >
          {submitting ? (
            'Redirecting…'
          ) : (
            <>
              {TICKET_COPY.continuePayment}
              <ArrowIcon />
            </>
          )}
        </button>
      </div>
      <p
        id={BUY_HINT_ID}
        ref={hintRef}
        tabIndex={-1}
        data-buy-hint=""
        role="status"
        className="nk-hint"
      >
        {hintVisible ? TICKET_COPY.buyHint : ''}
      </p>
    </form>
  );
}
