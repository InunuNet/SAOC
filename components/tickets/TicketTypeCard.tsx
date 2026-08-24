// F2 (ticketing-pages; edited by ticketing-multi-line-item-cart-ui F2) — presentational
// card for one ticket type inside TicketPurchaseForm's cart. The selection control is a
// quantity stepper (0 by default; pinned to 0 and disabled when soldOut — real capacity
// enforcement stays entirely server-side, this disable is UX only, matching the previous
// soldOut-disables-radio convention). No hooks/browser APIs of its own, so it needs no
// 'use client' directive — it inherits the client boundary from its parent form.
export interface TicketTypeCardData {
  slug: string;
  name: string;
  price: number;
  /** F1 (ticketing-flow-redesign, M1) — read-path wiring only; F2 displays it. See
   *  contracts/golden/ticketing-flow-redesign-f1/README.md §8. */
  regularPrice?: number | null;
  description: string;
  soldOut: boolean;
  /** F4 (multi-line-item-cart, M2) — gates a real, visible "provisional" text marker. See
   *  contracts/golden/ticketing-f4-admission-products/README.md, "UI: provisional badge is
   *  flag-gated, observably". Required (not optional) so the UI gate can never silently
   *  degrade to "never show the badge". */
  provisional: boolean;
  /** F5 (ticketing-f5-day-attendees) — gates CartDayPicker rendering for this type.
   *  Required (not optional), same posture as `provisional`, so the day-picker gate can
   *  never silently degrade to "never render". */
  requiresDaySelection: boolean;
}

interface TicketTypeCardProps {
  ticketType: TicketTypeCardData;
  quantity: number;
  onQuantityChange: (slug: string, quantity: number) => void;
  soldOutLabel: string;
  decreaseLabel: string;
  increaseLabel: string;
}

export function TicketTypeCard({
  ticketType,
  quantity,
  onQuantityChange,
  soldOutLabel,
  decreaseLabel,
  increaseLabel,
}: TicketTypeCardProps) {
  const { slug, name, price, description, soldOut, provisional } = ticketType;
  const inputId = `ticket-type-qty-${slug}`;

  function decrease() {
    if (soldOut) return;
    onQuantityChange(slug, Math.max(0, quantity - 1));
  }

  function increase() {
    if (soldOut) return;
    onQuantityChange(slug, quantity + 1);
  }

  return (
    <div
      className={`flex items-start justify-between gap-4 border p-5 transition ${
        soldOut
          ? 'border-rule bg-bone/60 opacity-60'
          : quantity > 0
            ? 'border-ink bg-bone'
            : 'border-rule bg-parchment'
      }`}
    >
      <div>
        <p className="font-serif text-[18px] font-semibold text-ink">{name}</p>
        <p id={`${inputId}-desc`} className="mt-1 font-sans text-[13px] text-ink/70">
          {description}
        </p>
        {soldOut ? (
          <span className="mt-2 inline-block font-mono text-[10px] uppercase tracking-[0.16em] text-accent">
            {soldOutLabel}
          </span>
        ) : null}
        {provisional ? (
          <span
            data-testid="provisional-badge"
            className="mt-2 block font-sans text-[12px] italic text-ink/70"
          >
            Provisional pricing — subject to change
          </span>
        ) : null}
      </div>

      <div className="flex shrink-0 flex-col items-end gap-2">
        <p className="font-serif text-[20px] font-medium text-ink">
          {price === 0 ? 'Free' : `R${price.toFixed(2)}`}
        </p>
        <div className="flex items-center gap-2" role="group" aria-label={`${name} quantity`}>
          <button
            type="button"
            onClick={decrease}
            disabled={soldOut || quantity === 0}
            aria-label={`${decreaseLabel} ${name}`}
            className="flex h-8 w-8 items-center justify-center rounded-sm border border-rule font-sans text-[16px] text-ink transition-colors hover:bg-bone disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/40 focus-visible:ring-offset-2"
          >
            −
          </button>
          <input
            id={inputId}
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            value={quantity}
            disabled={soldOut}
            aria-describedby={`${inputId}-desc`}
            aria-label={`${name} quantity`}
            onChange={(e) => {
              const parsed = Number.parseInt(e.target.value, 10);
              onQuantityChange(slug, Number.isNaN(parsed) ? 0 : Math.max(0, parsed));
            }}
            className="w-12 rounded-sm border border-rule bg-ivory px-1 py-1 text-center font-sans text-[15px] text-ink disabled:opacity-60"
          />
          <button
            type="button"
            onClick={increase}
            disabled={soldOut}
            aria-label={`${increaseLabel} ${name}`}
            className="flex h-8 w-8 items-center justify-center rounded-sm border border-rule font-sans text-[16px] text-ink transition-colors hover:bg-bone disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/40 focus-visible:ring-offset-2"
          >
            +
          </button>
        </div>
      </div>
    </div>
  );
}
