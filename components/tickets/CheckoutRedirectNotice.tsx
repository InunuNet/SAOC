// F2 (ticketing-multi-line-item-cart-ui) — pre-redirect amount display. Split out of
// TicketPurchaseForm to keep it under the project's 150-line limit. Renders the amount
// from the CHECKOUT RESPONSE'S fields.amount (server-derived, from
// paymentProvider.initiate(...)) — NEVER the pre-submit computeCartTotal() estimate. See
// contracts/golden/ticketing-multi-line-item-cart-ui/README.md, "Why the running total
// is explicitly an estimate".
import { PayfastRedirectForm } from '@/components/tickets/PayfastRedirectForm';

interface CheckoutRedirectNoticeProps {
  processUrl: string;
  fields: Record<string, string>;
}

export function CheckoutRedirectNotice({ processUrl, fields }: CheckoutRedirectNoticeProps) {
  return (
    <div className="space-y-4">
      <p role="status" className="font-serif text-[18px] text-ink">
        You&apos;re about to pay <strong>R{fields.amount}</strong> via PayFast…
      </p>
      <PayfastRedirectForm processUrl={processUrl} fields={fields} />
    </div>
  );
}
