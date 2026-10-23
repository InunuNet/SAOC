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
import Link from 'next/link';

import { formatRand } from '@/components/nos/cheapest-admission';

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
  /** F18b — a screen with several provisional types states "Provisional pricing" once, so
   *  the form turns the badge off on every card after the first. Default: shown. */
  showProvisionalBadge?: boolean;
  /** F18b — a single-type screen already shows the description as the hero standfirst, so the
   *  card keeps it for assistive technology only. Default: shown. */
  descriptionAssistiveOnly?: boolean;
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
  showProvisionalBadge = true,
  descriptionAssistiveOnly = false,
}: TicketTypeCardProps) {
  const { slug, name, price, description, soldOut, provisional } = ticketType;
  const inputId = `ticket-type-qty-${slug}`;
  // F2 (ticketing-complete, M1): repo-wide `data-placeholder` convention (see
  // components/societies/SocietyAbout.tsx) — lets an integrity check or Playwright grep
  // the rendered DOM directly, rather than relying on someone noticing the text badge.
  const placeholderAttrs = provisional ? { 'data-placeholder': 'true' } : {};

  function decrease() {
    if (soldOut || !onQuantityChange) return;
    onQuantityChange(slug, Math.max(0, quantity - 1));
  }

  function increase() {
    if (soldOut || !onQuantityChange) return;
    onQuantityChange(slug, quantity + 1);
  }

  const cardClassName = `flex flex-col gap-3 border p-5 transition-colors ${
    soldOut
      ? 'border-rule bg-bone/60 opacity-60'
      : quantity > 0
        ? 'border-ink bg-bone'
        : 'border-rule bg-parchment'
  }`;

  const cardContent = (
    <>
      <p className="font-serif font-normal text-[22px] leading-tight text-ink">{name}</p>
      <p
        data-ticket-price=""
        className="font-serif font-light text-[clamp(34px,4.4vw,48px)] leading-none tabular-nums text-ink"
      >
        {price === 0 ? 'Free' : formatRand(price)}
      </p>
      <p
        id={`${inputId}-desc`}
        className={
          descriptionAssistiveOnly ? 'sr-only' : 'font-sans text-[16px] leading-[1.55] text-muted'
        }
      >
        {description}
      </p>

      {provisional && showProvisionalBadge ? (
        <span data-testid="provisional-badge" className="font-sans text-[12px] italic text-ink/70">
          Provisional pricing — subject to change
        </span>
      ) : null}
      {soldOut ? (
        <span className="inline-block font-mono text-[12px] uppercase tracking-[0.16em] text-accent">
          {soldOutLabel}
        </span>
      ) : null}
    </>
  );

  if (mode === 'list') {
    return (
      <Link
        href={`/tickets/${slug}`}
        className={`${cardClassName} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring-focus)]`}
        {...placeholderAttrs}
      >
        {cardContent}
        <span className="mt-1 font-sans text-[14px] font-medium text-primary underline-offset-2">
          View tickets →
        </span>
      </Link>
    );
  }

  return (
    <div className={cardClassName} {...placeholderAttrs}>
      {cardContent}
      {hideQuantityStepper ? null : (
        <div className="flex items-center gap-2" role="group" aria-label={`${name} quantity`}>
          <button
            type="button"
            onClick={decrease}
            disabled={soldOut}
            aria-disabled={quantity === 0 || undefined}
            aria-label={`${decreaseLabel ?? 'Decrease quantity of'} ${name}`}
            className="flex h-11 w-11 items-center justify-center rounded-sm border border-rule font-sans text-[16px] text-ink transition-colors hover:bg-bone disabled:cursor-not-allowed disabled:opacity-40 aria-disabled:cursor-not-allowed aria-disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring-focus)]"
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
            className="h-11 w-12 rounded-sm border border-rule bg-ivory px-1 py-1 text-center font-sans text-[15px] text-ink disabled:opacity-60"
          />
          <button
            type="button"
            onClick={increase}
            disabled={soldOut}
            aria-label={`${increaseLabel ?? 'Increase quantity of'} ${name}`}
            className="flex h-11 w-11 items-center justify-center rounded-sm border border-rule font-sans text-[16px] text-ink transition-colors hover:bg-bone disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring-focus)]"
          >
            +
          </button>
        </div>
      )}
    </div>
  );
}
