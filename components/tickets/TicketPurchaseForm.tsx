'use client';

import { Button } from '@/components/nos/Button';
import { TicketTypeCard, type TicketTypeCardData } from '@/components/tickets/TicketTypeCard';
import { CartAttendeeFields } from '@/components/tickets/CartAttendeeFields';
import { CartDayPicker } from '@/components/tickets/CartDayPicker';
import { DayQuantityPicker } from '@/components/tickets/DayQuantityPicker';
import { CheckoutRedirectNotice } from '@/components/tickets/CheckoutRedirectNotice';
import { OzowSandboxTestModeBanner } from '@/components/tickets/OzowSandboxTestModeBanner';
import { useTicketCart } from '@/components/tickets/useTicketCart';

interface TicketPurchaseFormProps {
  ticketTypes: TicketTypeCardData[];
  buyButtonLabel: string;
  soldOutMessage: string;
  showDays: string[];
  /** F16: true only for a verified admin viewer (resolved server-side); the Ozow test-mode strip is never public. */
  showTestModeBanner?: boolean;
}

export function TicketPurchaseForm({
  ticketTypes,
  buyButtonLabel,
  soldOutMessage,
  showDays,
  showTestModeBanner = false,
}: TicketPurchaseFormProps) {
  const cart = useTicketCart(ticketTypes, showDays);
  // F3 (ticketing-flow-redesign) — same derived condition used in useTicketCart.submit():
  // exactly one day-selection type in this screen's cart (README §3).
  const useDayQuantityPicker =
    ticketTypes.length === 1 && ticketTypes[0].requiresDaySelection === true;

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
    void cart.submit();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6" noValidate data-nos-ticket-form="">
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
          />
        ))}
      </fieldset>

      <p aria-live="polite" aria-atomic="true" className="font-sans text-[15px] text-ink">
        Estimated total: <strong>R{cart.estimatedTotal.toFixed(2)}</strong>{' '}
        <span className="font-mono text-[12px] tracking-[0.16em] text-muted">(estimate)</span>
      </p>

      <CartAttendeeFields
        ticketTypes={ticketTypes}
        quantities={cart.quantities}
        attendeesByType={cart.attendeesByType}
        errors={cart.attendeeErrors}
        disabled={cart.status === 'submitting'}
        onAttendeeChange={cart.updateAttendeeField}
      />

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

      <Button
        type="submit"
        disabled={cart.status === 'submitting' || cart.cartItemCount === 0}
        className="disabled:cursor-not-allowed disabled:opacity-60"
      >
        {cart.status === 'submitting' ? 'Redirecting…' : buyButtonLabel}
      </Button>
    </form>
  );
}
