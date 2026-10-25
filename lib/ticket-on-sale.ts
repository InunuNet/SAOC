// The one server-side answer to "may this ticket type be sold right now?". Checkout, the
// /tickets/[slug] detail page and the tickets hub all ask it, so a demo fixture or a type that
// checkout would refuse can never be offered on one surface and refused on another.
//
// Pure: no I/O, no firebase-admin, no Date.now(). The caller supplies the clock, the active show,
// the CMS sales switch and the pooled sold-out verdict (planPooledCapacity needs Firestore, so
// the predicate takes its result rather than reading the ledger itself).
import { effectiveCapacity, resolveEffectivePrice } from '@/lib/checkout-reservation';
import { isDemoTicketTypeDoc } from '@/lib/demo-ticket-type';

export type NotOnSaleReason =
  | 'demo'
  | 'inactive'
  | 'sales-closed'
  | 'wrong-show'
  | 'no-price'
  | 'no-capacity'
  | 'sold-out';

// Not `number` / `boolean`: Sanity does not enforce field types at read time, so every field the
// predicate judges is `unknown` and narrowed here, never asserted.
export interface OnSaleDoc {
  slug?: string | null;
  demo?: boolean | null;
  active?: unknown;
  price: unknown;
  regularPrice?: unknown;
  earlyBirdCutoff?: unknown;
  capacity: unknown;
  releasedQuantity?: unknown;
  show?: { _ref: string } | null;
}

export interface OnSaleInput {
  doc: OnSaleDoc;
  activeShowId: string | null;
  salesOpen: boolean;
  /** The pooled sold-out verdict for this type; false when the caller has no ledger to read. */
  soldOut: boolean;
  now: Date;
  qaFixturesAllowed: boolean;
}

export type OnSaleVerdict =
  | { onSale: true; reason: null }
  | { onSale: false; reason: NotOnSaleReason };

interface TicketTypeShowRef {
  show?: { _ref: string } | null;
}

/**
 * Rejects whenever the ticket type's `show` reference doesn't match the currently active show,
 * including "no active show at all" (`activeShowId === null`) and "ticket type predates the
 * `show` reference field" (no `show` at all).
 */
export function ticketTypeMatchesActiveShow(
  ticketType: TicketTypeShowRef,
  activeShowId: string | null
): boolean {
  if (activeShowId === null) return false;
  return ticketType.show?._ref === activeShowId;
}

function isUsableAmount(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function isUsableCapacity(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function isUsableReleasedQuantity(value: unknown): value is number | null {
  if (value === null || value === undefined) return true;
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function hasSellablePrice(doc: OnSaleDoc, now: Date): boolean {
  if (!isUsableAmount(doc.price)) return false;
  const regularPrice = typeof doc.regularPrice === 'number' ? doc.regularPrice : null;
  const earlyBirdCutoff =
    typeof doc.earlyBirdCutoff === 'string' && doc.earlyBirdCutoff.trim().length > 0
      ? doc.earlyBirdCutoff
      : null;
  return (
    resolveEffectivePrice({ price: doc.price, regularPrice, earlyBirdCutoff, now }) !== null
  );
}

function hasSellableCapacity(doc: OnSaleDoc): boolean {
  if (!isUsableCapacity(doc.capacity)) return false;
  if (!isUsableReleasedQuantity(doc.releasedQuantity)) return false;
  return effectiveCapacity(doc.capacity, doc.releasedQuantity) > 0;
}

/**
 * First failing reason wins, in this order: demo, inactive, sales-closed, wrong-show, no-price,
 * no-capacity, sold-out. `qaFixturesAllowed` waives the demo reason and nothing else.
 */
export function isTicketOnSale(input: OnSaleInput): OnSaleVerdict {
  const { doc, activeShowId, salesOpen, soldOut, now, qaFixturesAllowed: qaAllowed } = input;
  if (isDemoTicketTypeDoc(doc) && !qaAllowed) return { onSale: false, reason: 'demo' };
  if (doc.active !== true) return { onSale: false, reason: 'inactive' };
  if (!salesOpen) return { onSale: false, reason: 'sales-closed' };
  if (!ticketTypeMatchesActiveShow(doc, activeShowId)) {
    return { onSale: false, reason: 'wrong-show' };
  }
  if (!hasSellablePrice(doc, now)) return { onSale: false, reason: 'no-price' };
  if (!hasSellableCapacity(doc)) return { onSale: false, reason: 'no-capacity' };
  if (soldOut) return { onSale: false, reason: 'sold-out' };
  return { onSale: true, reason: null };
}

/**
 * Demo fixtures are purchasable only outside a production build AND while payments are not live.
 * Read at request time by the caller. `paymentsLive` is passed in (callers pass
 * `!isTicketingTestMode()`) so the single off switch stays in lib/ticketing-test-mode.ts.
 */
export function qaFixturesAllowed(env: { NODE_ENV?: string }, paymentsLive: boolean): boolean {
  return !paymentsLive && env.NODE_ENV !== 'production';
}
