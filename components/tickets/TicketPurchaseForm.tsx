'use client';

import { useRef, useState } from 'react';

import { Button } from '@/components/nos/Button';
import { formatRand } from '@/components/nos/cheapest-admission';
import { TicketTypeCard, type TicketTypeCardData } from '@/components/tickets/TicketTypeCard';
import { CartAttendeeFields } from '@/components/tickets/CartAttendeeFields';
import { CartDayPicker } from '@/components/tickets/CartDayPicker';
import { DayQuantityPicker } from '@/components/tickets/DayQuantityPicker';
import { CheckoutRedirectNotice } from '@/components/tickets/CheckoutRedirectNotice';
import { OzowSandboxTestModeBanner } from '@/components/tickets/OzowSandboxTestModeBanner';
import { useTicketCart, type CartPrefill } from '@/components/tickets/useTicketCart';
import { TICKET_COPY } from '@/lib/data/ticket-presentation';

// Buy stays enabled at quantity 0; a click there fills the hint (TICKET_COPY.buyHint, Choose at least one ticket).
const BUY_HINT_ID = 'ticket-buy-hint';
const FIRST_QUANTITY_FIELD = 'input[id^="ticket-type-qty-"], input[id^="day-quantity-"]';

interface TicketPurchaseFormProps {
  ticketTypes: TicketTypeCardData[];
  buyButtonLabel: string;
  soldOutMessage: string;
  showDays: string[];
  /** F18b: quantity (and day) a hub card's "Buy ticket" link opened the screen with. */
  prefill?: CartPrefill;
  /** F16: true only for a verified admin viewer (resolved server-side); the Ozow test-mode strip is never public. */
  showTestModeBanner?: boolean;
}

export function TicketPurchaseForm({
  ticketTypes,
  buyButtonLabel,
  soldOutMessage,
  showDays,
  prefill,
  showTestModeBanner = false,
}: TicketPurchaseFormProps) {
  const cart = useTicketCart(ticketTypes, showDays, prefill);
  const formRef = useRef<HTMLFormElement>(null);
  const [hintRequested, setHintRequested] = useState(false);
  // F3 (ticketing-flow-redesign) — same derived condition used in useTicketCart.submit():
  // exactly one day-selection type in this screen's cart (README §3).
  const useDayQuantityPicker =
    ticketTypes.length === 1 && ticketTypes[0].requiresDaySelection === true;
  // "Provisional pricing" is stated once, on the first provisional type only.
  const firstProvisionalSlug = ticketTypes.find((t) => t.provisional)?.slug ?? null;
  const hintVisible = hintRequested && cart.cartItemCount === 0;

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

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (cart.cartItemCount === 0) {
      setHintRequested(true);
      formRef.current?.querySelector<HTMLInputElement>(FIRST_QUANTITY_FIELD)?.focus();
      return;
    }
    void cart.submit();
  }

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className="space-y-6"
      noValidate
      data-nos-ticket-form=""
    >
      {showTestModeBanner ? <OzowSandboxTestModeBanner /> : null}
      <fieldset className="space-y-3">
        <legend className="font-mono text-[12px] tracking-[0.16em] text-muted">Ticket types</legend>
        {ticketTypes.map((t) => (
          <TicketTypeCard
            key={t.slug}
            ticketType={t}
            mode="buy"
            quantity={cart.quantities[t.slug] ?? 0}
            onQuantityChange={cart.updateQuantity}
            soldOutLabel={soldOutMessage}
            decreaseLabel="Decrease quantity of"
            increaseLabel="Increase quantity of"
            hideQuantityStepper={useDayQuantityPicker}
            showProvisionalBadge={t.slug === firstProvisionalSlug}
            descriptionAssistiveOnly={ticketTypes.length === 1}
          />
        ))}
      </fieldset>

      {useDayQuantityPicker ? (
        <DayQuantityPicker
          showDays={showDays}
          quantitiesByDay={cart.quantitiesByDay}
          onQuantityChange={cart.updateDayQuantity}
          disabled={cart.status === 'submitting'}
        />
      ) : (
        <CartDayPicker
          ticketTypes={ticketTypes}
          quantities={cart.quantities}
          showDays={showDays}
          chosenDayByType={cart.chosenDayByType}
          errors={cart.chosenDayErrors}
          disabled={cart.status === 'submitting'}
          onChosenDayChange={cart.updateChosenDay}
        />
      )}

      <CartAttendeeFields
        ticketTypes={ticketTypes}
        quantities={cart.quantities}
        attendeesByType={cart.attendeesByType}
        errors={cart.attendeeErrors}
        disabled={cart.status === 'submitting'}
        onAttendeeChange={cart.updateAttendeeField}
      />

      {cart.cartError ? (
        <p
          role="alert"
          className="border border-primary-800 bg-bone px-4 py-3 font-sans text-[13px] text-primary-800"
        >
          {cart.cartError}
        </p>
      ) : null}

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
        className="flex flex-wrap items-center justify-between gap-4"
      >
        <p className="font-sans text-[15px] text-ink">
          Total <strong className="tabular-nums">{formatRand(cart.estimatedTotal)}</strong>
        </p>
        <Button
          type="submit"
          disabled={cart.status === 'submitting'}
          aria-describedby={BUY_HINT_ID}
        >
          {cart.status === 'submitting' ? 'Redirecting…' : buyButtonLabel}
        </Button>
      </div>
      <p
        id={BUY_HINT_ID}
        data-buy-hint=""
        role="status"
        className="font-sans text-[14px] text-primary-800"
      >
        {hintVisible ? TICKET_COPY.buyHint : ''}
      </p>
    </form>
  );
}
