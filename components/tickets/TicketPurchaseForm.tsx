'use client';

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
}

export function TicketPurchaseForm({
  ticketTypes,
  buyButtonLabel,
  soldOutMessage,
  showDays,
}: TicketPurchaseFormProps) {
  const cart = useTicketCart(ticketTypes, showDays);
  // F3 (ticketing-flow-redesign) — same derived condition used in useTicketCart.submit():
  // exactly one day-selection type in this screen's cart (README §3).
  const useDayQuantityPicker = ticketTypes.length === 1 && ticketTypes[0].requiresDaySelection === true;

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
    <form onSubmit={handleSubmit} className="space-y-6" noValidate>
      <OzowSandboxTestModeBanner />
      <fieldset className="space-y-3">
        <legend className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted">Ticket types</legend>
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

      <p className="font-sans text-[15px] text-ink">
        Estimated total: <strong>R{cart.estimatedTotal.toFixed(2)}</strong>{' '}
        <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted">(estimate)</span>
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
        <p role="alert" className="border border-primary-800 bg-bone px-4 py-3 font-sans text-[13px] text-primary-800">
          {cart.cartError}
        </p>
      ) : null}

      {cart.status === 'error' && cart.errorMessage ? (
        <p role="alert" className="border border-primary-800 bg-bone px-4 py-3 font-sans text-[14px] text-primary-800">
          {cart.errorMessage}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={cart.status === 'submitting'}
        className="rounded-sm bg-accent px-5 py-2.5 font-sans text-[14px] font-medium text-ivory transition-colors hover:bg-accent-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/40 focus-visible:ring-offset-2 focus-visible:ring-offset-ivory disabled:cursor-not-allowed disabled:opacity-60"
      >
        {cart.status === 'submitting' ? 'Redirecting…' : buyButtonLabel}
      </button>
    </form>
  );
}
