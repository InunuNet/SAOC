/**
 * ticket-pdf (F1, D2) — the access decision for GET /api/tickets/pdf, as a pure function with an
 * injected order lookup so the contract check can exercise it without Firestore.
 *
 * Proof of ownership is exactly what the confirmation page accepts today: the order reference
 * (`m_payment_id`, a random capability value) resolved by `getConfirmedOrderForDisplay`, which
 * fails closed unless the order is paid. A bookingRef alone is never accepted: `ref` is only ever
 * matched against orders, and `position` can only select among THAT order's own positions.
 *
 * Every failure collapses into the one frozen DENIED result so no caller can tell a missing ref
 * from an unpaid order from another order's position (no 403/404 oracle).
 */

const MAX_REF_LENGTH = 64;

export interface ConfirmedOrderLike<P extends { bookingRef: string }> {
  reference: string;
  positions: P[];
}

export interface TicketPdfAccessDeps<P extends { bookingRef: string }> {
  getConfirmedOrder: (reference: string) => Promise<ConfirmedOrderLike<P> | null>;
}

export interface TicketPdfAccessParams {
  ref: string | null;
  position: string | null;
}

export type TicketPdfAccessResult<P extends { bookingRef: string }> =
  | { ok: true; orderReference: string; positions: P[]; single: boolean }
  | { ok: false; status: 404 };

const DENIED = Object.freeze({ ok: false, status: 404 } as const);

/** Refs are logged as an 8-character prefix at most. */
export function refPrefix(ref: string | null | undefined): string {
  return (ref ?? '').slice(0, 8);
}

export async function authoriseTicketPdfRequest<P extends { bookingRef: string }>(
  params: TicketPdfAccessParams,
  deps: TicketPdfAccessDeps<P>
): Promise<TicketPdfAccessResult<P>> {
  const ref = params.ref?.trim() ?? '';
  if (ref.length === 0 || ref.length > MAX_REF_LENGTH) return DENIED;

  let order: ConfirmedOrderLike<P> | null;
  try {
    order = await deps.getConfirmedOrder(ref);
  } catch (error) {
    console.error('[tickets/pdf] order lookup failed', {
      refPrefix: refPrefix(ref),
      errorType: error instanceof Error ? error.name : typeof error,
    });
    return DENIED;
  }
  if (!order || order.positions.length === 0) return DENIED;

  if (params.position === null) {
    return { ok: true, orderReference: order.reference, positions: order.positions, single: false };
  }

  const wanted = params.position.trim();
  const match = order.positions.find((candidate) => candidate.bookingRef === wanted);
  if (!match) return DENIED;
  return { ok: true, orderReference: order.reference, positions: [match], single: true };
}
