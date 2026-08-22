// F2 (ticketing-multi-line-item-cart-ui) — pre-redirect amount display. Split out of
// TicketPurchaseForm to keep it under the project's 150-line limit. Renders the amount
// from the CHECKOUT RESPONSE'S provider-neutral `amount` field (server-derived, the same
// amountFormatted string passed into paymentProvider.initiate()) — NEVER the pre-submit
// computeCartTotal() estimate, and NEVER read off the `fields` object: `fields` is each
// gateway's own wire-format payload, and its key casing for the money value differs per
// gateway (see lib/payments/ — Codex GPT-5.5 review, 2026-08-22), so it is not a display
// contract. See contracts/golden/ticketing-multi-line-item-cart-ui/README.md, "Why the
// running total is explicitly an estimate".
import { PayfastRedirectForm } from '@/components/tickets/PayfastRedirectForm';
import { providerLabel } from '@/lib/payments-ui';

interface CheckoutRedirectNoticeProps {
  processUrl: string;
  fields: Record<string, string>;
  amount: string;
  providerId: string;
}

export function CheckoutRedirectNotice({
  processUrl,
  fields,
  amount,
  providerId,
}: CheckoutRedirectNoticeProps) {
  return (
    <div className="space-y-4">
      <p role="status" className="font-serif text-[18px] text-ink">
        You&apos;re about to pay <strong>R{amount}</strong> via {providerLabel(providerId)}…
      </p>
      <PayfastRedirectForm processUrl={processUrl} fields={fields} />
    </div>
  );
}
