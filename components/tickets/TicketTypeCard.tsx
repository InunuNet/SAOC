// F2 (ticketing-pages; edited by ticketing-multi-line-item-cart-ui F2, then
// ticketing-flow-redesign F2) — presentational card for one ticket type. `mode: 'list'`
// renders the photo/name/price/badge block wrapped in a Link to the dedicated buy screen
// (no stepper); `mode: 'buy'` renders the same block plus the quantity stepper (unchanged
// stepper logic), no Link. One component, not two, so the visual identity stays defined in
// exactly one place. See contracts/golden/ticketing-flow-redesign-f2/README.md §3.
//
// The stepper's soldOut disable is UX only — real capacity enforcement stays entirely
// server-side. No hooks/browser APIs of its own beyond next/image, so it needs no
// 'use client' directive — it inherits the client boundary from its parent form.
import Image from 'next/image';
import Link from 'next/link';

import { getOrchidImageForTicketType } from '@/lib/tickets-orchid-image';

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
  mode: 'list' | 'buy';
  soldOutLabel: string;
  /** Required only when `mode === 'buy'` — the list mode never renders the stepper. */
  quantity?: number;
  onQuantityChange?: (slug: string, quantity: number) => void;
  decreaseLabel?: string;
  increaseLabel?: string;
  /** F3 (ticketing-flow-redesign) — `mode: 'buy'` only. Hides (not merely disables) this
   *  card's own stepper when a screen-level picker (e.g. DayQuantityPicker) is the single
   *  source of truth for "how many" instead — see contracts/golden/
   *  ticketing-flow-redesign-f3/README.md §3. */
  hideQuantityStepper?: boolean;
}

export function TicketTypeCard({
  ticketType,
  mode,
  quantity = 0,
  onQuantityChange,
  soldOutLabel,
  decreaseLabel,
  increaseLabel,
  hideQuantityStepper = false,
}: TicketTypeCardProps) {
  const { slug, name, price, description, soldOut, provisional } = ticketType;
  const inputId = `ticket-type-qty-${slug}`;

  function decrease() {
    if (soldOut || !onQuantityChange) return;
    onQuantityChange(slug, Math.max(0, quantity - 1));
  }

  function increase() {
    if (soldOut || !onQuantityChange) return;
    onQuantityChange(slug, quantity + 1);
  }

  const cardClassName = `flex flex-col gap-3 border p-5 transition ${
    soldOut
      ? 'border-rule bg-bone/60 opacity-60'
      : quantity > 0
        ? 'border-ink bg-bone'
        : 'border-rule bg-parchment'
  }`;

  const cardContent = (
    <>
      <div className="relative aspect-[4/3] w-full overflow-hidden">
        <Image
          src={getOrchidImageForTicketType(slug)}
          alt={name}
          fill
          className="object-cover"
        />
      </div>

      <p className="font-serif text-[18px] font-semibold text-ink">{name}</p>
      <p className="font-serif text-[20px] font-medium text-ink">
        {price === 0 ? 'Free' : `R${price.toFixed(2)}`}
      </p>
      <p id={`${inputId}-desc`} className="font-sans text-[13px] text-ink/70">
        {description}
      </p>

      {provisional ? (
        <span
          data-testid="provisional-badge"
          className="font-sans text-[12px] italic text-ink/70"
        >
          Provisional pricing — subject to change
        </span>
      ) : null}
      {soldOut ? (
        <span className="inline-block font-mono text-[10px] uppercase tracking-[0.16em] text-accent">
          {soldOutLabel}
        </span>
      ) : null}
    </>
  );

  if (mode === 'list') {
    return (
      <Link href={`/tickets/${slug}`} className={cardClassName}>
        {cardContent}
        <span className="mt-1 font-sans text-[14px] font-medium text-accent underline-offset-2">
          View tickets →
        </span>
      </Link>
    );
  }

  return (
    <div className={cardClassName}>
      {cardContent}
      {hideQuantityStepper ? null : (
      <div className="flex items-center gap-2" role="group" aria-label={`${name} quantity`}>
        <button
          type="button"
          onClick={decrease}
          disabled={soldOut || quantity === 0}
          aria-label={`${decreaseLabel ?? 'Decrease quantity of'} ${name}`}
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
            onQuantityChange?.(slug, Number.isNaN(parsed) ? 0 : Math.max(0, parsed));
          }}
          className="w-12 rounded-sm border border-rule bg-ivory px-1 py-1 text-center font-sans text-[15px] text-ink disabled:opacity-60"
        />
        <button
          type="button"
          onClick={increase}
          disabled={soldOut}
          aria-label={`${increaseLabel ?? 'Increase quantity of'} ${name}`}
          className="flex h-8 w-8 items-center justify-center rounded-sm border border-rule font-sans text-[16px] text-ink transition-colors hover:bg-bone disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/40 focus-visible:ring-offset-2"
        >
          +
        </button>
      </div>
      )}
    </div>
  );
}
