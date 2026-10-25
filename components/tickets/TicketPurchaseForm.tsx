'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';

import { formatRand } from '@/components/nos/cheapest-admission';
import { CartAttendeeFields } from '@/components/tickets/CartAttendeeFields';
import { CheckoutRedirectNotice } from '@/components/tickets/CheckoutRedirectNotice';
import { OzowSandboxTestModeBanner } from '@/components/tickets/OzowSandboxTestModeBanner';
import { TicketFieldAlert } from '@/components/tickets/TicketFormField';
import { TicketingTestPayNotice } from '@/components/tickets/TicketingTestPayNotice';
import type { TicketTypeCardData } from '@/components/tickets/TicketTypeCard';
import { useTicketCart } from '@/components/tickets/useTicketCart';
import { ArrowIcon, MinusIcon, PlusIcon } from '@/components/tickets/keepsake/parts';
import { CHECKOUT_DAY_EVENT } from '@/components/tickets/keepsake/checkout-day';
import { DayCount, DayCountNote, hasDayCountLine } from '@/components/tickets/keepsake/DayCount';
import { isDayClosed } from '@/components/tickets/keepsake/days';
import type { KeepsakeDay } from '@/components/tickets/keepsake/types';
import { CART_MAX_LINE_ITEMS } from '@/lib/cart';
import { TICKET_COPY } from '@/lib/data/ticket-presentation';
import { formatShowDay, formatShowDayShort } from '@/lib/show-day-format';
import { useHydrated } from '@/lib/hooks/useHydrated';

// The CTA stays enabled at quantity 0; a click there fills the hint and moves focus to it.
// It also stays enabled with no day chosen (r45b): a click shows the picker's required-field error
// and moves focus to the picker.
const BUY_HINT_ID = 'ticket-buy-hint';
const MIN_QUANTITY = 1;
const DAY_GROUP = 'checkout-day';
const HTTP_CONFLICT = 409;

interface TicketPurchaseFormProps {
  ticketTypes: TicketTypeCardData[];
  showDays: string[];
  // A hub card's "Buy ticket" link opens the screen with its quantity (and day) chosen.
  initialQuantity?: number;
  initialDay?: string | null;
  // True only for a verified admin viewer (resolved server-side); the Ozow test-mode strip is
  // never public.
  showTestModeBanner?: boolean;
  // The Day Pass's per-day counts, read server-side from the hub's own loader (rLC, r45 P3).
  dayCounts?: KeepsakeDay[] | null;
  showProvisional?: boolean;
}

function startQuantity(requested: number | undefined): number {
  if (requested === undefined || !Number.isFinite(requested)) return MIN_QUANTITY;
  return Math.min(CART_MAX_LINE_ITEMS, Math.max(MIN_QUANTITY, Math.trunc(requested)));
}

// A day product opens on the day the link named, else with no day chosen (r45b: never a default).
function startDay(
  type: TicketTypeCardData,
  showDays: string[],
  requested: string | null | undefined
): string | null {
  if (!type.requiresDaySelection) return null;
  return requested && showDays.includes(requested) ? requested : null;
}

export function TicketPurchaseForm({
  ticketTypes,
  showDays,
  initialQuantity,
  initialDay,
  showTestModeBanner = false,
  dayCounts = null,
  showProvisional = false,
}: TicketPurchaseFormProps) {
  const hydrated = useHydrated();
  const ticketType = ticketTypes[0];
  const cart = useTicketCart(ticketType, {
    quantity: startQuantity(initialQuantity),
    day: startDay(ticketType, showDays, initialDay),
  });
  const hintRef = useRef<HTMLParagraphElement>(null);
  const [hintRequested, setHintRequested] = useState(false);
  const hintVisible = hintRequested && cart.quantity < MIN_QUANTITY;
  const dayGroupRef = useRef<HTMLFieldSetElement>(null);
  const [dayRequested, setDayRequested] = useState(false);
  const dayInvalid = dayRequested && cart.day === null;

  // A 409 for a chosen day may mean that day sold out between load and submit. The counts are
  // re-read (router.refresh re-runs the page's hub loader); if the day that was submitted is now
  // closed the server's own text is shown at the day group, else it stays the form-level alert.
  // Each submit's 409 is judged once, for the day that submit carried.
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  const [dayError, setDayError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<{ day: string; judged: boolean } | null>(null);
  const sawRefresh = useRef(false);
  const raced =
    ticketType.requiresDaySelection &&
    cart.errorStatus === HTTP_CONFLICT &&
    submitted !== null &&
    !submitted.judged;

  useEffect(() => {
    if (raced) startRefresh(() => router.refresh());
  }, [raced, router]);

  useEffect(() => {
    if (!raced || submitted === null) return;
    if (refreshing) {
      sawRefresh.current = true;
      return;
    }
    if (!sawRefresh.current) return;
    sawRefresh.current = false;
    setSubmitted({ day: submitted.day, judged: true });
    const count = dayCounts?.find((c) => c.day === submitted.day);
    // A buyer who has moved to another day since keeps the error form-level.
    if (cart.day !== submitted.day || !count || !isDayClosed(count)) return;
    // The refreshed counts arrive from the server after the render, so this can only be learned here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDayError(cart.errorMessage);
    cart.setDay(null);
    window.dispatchEvent(new CustomEvent(CHECKOUT_DAY_EVENT, { detail: null }));
    dayGroupRef.current?.querySelector<HTMLInputElement>('input:not(:disabled)')?.focus();
  }, [raced, submitted, refreshing, dayCounts, cart]);

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
    setDayError(null);
    cart.setDay(day);
    window.dispatchEvent(new CustomEvent(CHECKOUT_DAY_EVENT, { detail: day }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (ticketType.requiresDaySelection && cart.day === null) {
      setDayRequested(true);
      dayGroupRef.current?.querySelector<HTMLInputElement>('input:not(:disabled)')?.focus();
      return;
    }
    if (cart.quantity < MIN_QUANTITY) {
      setHintRequested(true);
      hintRef.current?.focus();
      return;
    }
    if (cart.day !== null) setSubmitted({ day: cart.day, judged: false });
    void cart.submit();
  }

  const submitting = cart.status === 'submitting';

  return (
    <form
      method="post"
      onSubmit={handleSubmit}
      className="nk-checkout grid gap-3"
      noValidate
      data-nos-ticket-form=""
    >
      {showTestModeBanner ? <OzowSandboxTestModeBanner /> : null}

      {ticketType.requiresDaySelection ? (
        <fieldset
          ref={dayGroupRef}
          className="days nk-days"
          aria-invalid={dayInvalid}
          {...(dayError === null ? {} : { 'aria-invalid': true })}
        >
          <legend>{TICKET_COPY.chooseDay}</legend>
          <div className="nk-days-row">
            {showDays.map((day) => {
              const count = dayCounts?.find((c) => c.day === day);
              const counted = count !== undefined && hasDayCountLine(count, showProvisional);
              const closed = count !== undefined && isDayClosed(count);
              const dayClasses = [
                'nk-day',
                closed ? 'is-out' : '',
                count?.state === 'low' ? 'is-low' : '',
              ]
                .filter(Boolean)
                .join(' ');
              const countId = `${DAY_GROUP}-count-${day}`;
              return (
                <label key={day} className={dayClasses}>
                  <input
                    type="radio"
                    name={DAY_GROUP}
                    value={day}
                    checked={cart.day === day}
                    disabled={submitting || closed}
                    aria-label={formatShowDay(day)}
                    aria-describedby={counted ? countId : undefined}
                    onChange={() => chooseDay(day)}
                  />
                  <b>
                    <time dateTime={day}>{formatShowDayShort(day)}</time>
                  </b>
                  {count ? (
                    <DayCount d={count} showProvisional={showProvisional} id={countId} />
                  ) : null}
                </label>
              );
            })}
          </div>
          {dayInvalid ? <TicketFieldAlert spaced>{TICKET_COPY.chooseDay}</TicketFieldAlert> : null}
          {dayError ? <TicketFieldAlert spaced>{dayError}</TicketFieldAlert> : null}
          {dayCounts ? <DayCountNote days={dayCounts} showProvisional={showProvisional} /> : null}
        </fieldset>
      ) : null}

      <div className="nk-field">
        <label htmlFor="ticket-quantity" className="nk-field-label">
          {TICKET_COPY.numberOfTickets}
        </label>
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
            <MinusIcon />
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
            <PlusIcon />
          </button>
        </div>
      </div>

      <CartAttendeeFields
        ticketTypes={ticketTypes}
        quantities={{ [ticketType.slug]: cart.quantity }}
        attendeesByType={{ [ticketType.slug]: cart.attendees }}
        errors={cart.attendeeErrors}
        disabled={submitting}
        onAttendeeChange={cart.updateAttendeeField}
      />

      {cart.status === 'error' && cart.errorMessage && dayError === null ? (
        <TicketFieldAlert>{cart.errorMessage}</TicketFieldAlert>
      ) : null}

      <TicketingTestPayNotice />
      <div data-catalogue-total="" className="nk-checkout-total">
        <p aria-live="polite" aria-atomic="true">
          Total <strong>{formatRand(cart.estimatedTotal)}</strong>
        </p>
        <button
          type="submit"
          className="nk-btn nk-cta"
          disabled={submitting || !hydrated}
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
