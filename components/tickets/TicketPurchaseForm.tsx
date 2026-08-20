'use client';

import { TicketTypeCard, type TicketTypeCardData } from '@/components/tickets/TicketTypeCard';
import { CartAttendeeFields } from '@/components/tickets/CartAttendeeFields';
import { CheckoutRedirectNotice } from '@/components/tickets/CheckoutRedirectNotice';
import { useTicketCart } from '@/components/tickets/useTicketCart';

interface TicketPurchaseFormProps {
  ticketTypes: TicketTypeCardData[];
  buyButtonLabel: string;
  soldOutMessage: string;
}

export function TicketPurchaseForm({ ticketTypes, buyButtonLabel, soldOutMessage }: TicketPurchaseFormProps) {
  const cart = useTicketCart(ticketTypes);

  if (cart.redirect) {
    return <CheckoutRedirectNotice processUrl={cart.redirect.processUrl} fields={cart.redirect.fields} />;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    void cart.submit();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6" noValidate>
      <fieldset className="space-y-3">
        <legend className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted">Ticket types</legend>
        {ticketTypes.map((t) => (
          <TicketTypeCard
            key={t.slug}
            ticketType={t}
            quantity={cart.quantities[t.slug] ?? 0}
            onQuantityChange={cart.updateQuantity}
            soldOutLabel={soldOutMessage}
            decreaseLabel="Decrease quantity of"
            increaseLabel="Increase quantity of"
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

      {cart.cartError ? (
        <p role="alert" className="font-sans text-[13px] text-accent">
          {cart.cartError}
        </p>
      ) : null}

      {cart.status === 'error' && cart.errorMessage ? (
        <p role="alert" className="font-sans text-[14px] text-accent">
          {cart.errorMessage}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={cart.status === 'submitting'}
        className="rounded-sm bg-accent px-5 py-2.5 font-sans text-[14px] font-medium text-ivory transition-colors hover:bg-accent-soft disabled:cursor-not-allowed disabled:opacity-60"
      >
        {cart.status === 'submitting' ? 'Redirecting to PayFast…' : buyButtonLabel}
      </button>
    </form>
  );
}
