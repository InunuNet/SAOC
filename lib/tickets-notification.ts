import { NextRequest, NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';

import type { PaymentProvider } from '@/lib/payments';
import { findReservedOrderByPaymentId, markOrderAndPositionPaidByPaymentId } from '@/lib/orders';
import { deliverConfirmationEmailAfterCommit, sendConfirmationEmail } from '@/lib/confirmation-email';

/**
 * Payment notification handler — SECURITY BOUNDARY, FAIL CLOSED.
 *
 * F2 (ozow-payment-provider, M2) — extracted, UNMODIFIED IN BEHAVIOUR, out of
 * app/api/tickets/itn/route.ts's former body so a second gateway (Ozow) can share the exact same
 * eleven-step logic without either gateway's route naming the other's provider. See
 * contracts/golden/ozow-m1-f2/README.md §4-5 for why this is two thin routes calling one helper
 * rather than one route branching on a query param or path segment, and why the PayFast
 * regression claim this refactor makes is behavioural, not byte-identical.
 *
 * The gateway POSTs application/x-www-form-urlencoded on payment completion. Every check below
 * must pass before an order is ever flipped to 'paid'. Any single failure logs which check failed
 * and leaves the order untouched — we still return HTTP 200 so the gateway stops retrying, but a
 * 200 response here never implies the payment was accepted.
 *
 * This route no longer knows which gateway it is talking to beyond the `paymentProvider`
 * instance its caller supplies. Every gateway-specific step (parsing the posted body,
 * authenticating it against the shared secret, resolving and judging the source IP, the
 * out-of-band server-confirm round trip, and the gateway's own status vocabulary) lives behind
 * the PaymentProvider interface (lib/payments/). What stays here is everything that is OURS and
 * cannot move without a behaviour change: the order lookup, the already-settled short circuit,
 * the amount comparison against our own stored figure, the atomic order+position write, and the
 * post-commit confirmation email.
 *
 * The ordering of the eleven steps is unchanged from the pre-F2 route and is load-bearing:
 * verification, then source-IP logging, then reference, then lookup, then the settled short
 * circuit, then the amount match, then the server confirmation, then the status check, then the
 * write, then the email. Nothing here may be reordered for tidiness — re-verified unmodified by
 * contracts/checks/payment-seam-f2/check-sequence-and-ownership.sh via ITN_PATH_OVERRIDE.
 *
 * Amount-match tolerance below ZAR 0.01 (fixed cents rounding, not a config).
 */
const AMOUNT_MATCH_TOLERANCE_CENTS = 1;

/** Always 200 — the gateway must stop retrying regardless of validation outcome. */
function acknowledge(): NextResponse {
  return NextResponse.json({ received: true }, { status: 200 });
}

/**
 * Pure amount-match comparison, extracted from step 7 below so it is testable with zero I/O
 * (see contracts/checks/ozow-sandbox-toggle-f1/check-notification-amount-match-test-mode.mjs).
 *
 * ozow-sandbox-toggle F1 (README §3b) — compares against `lookup.expectedGatewayAmount` when
 * set (an Ozow order created while the sandbox test-mode flag was on, where we ourselves told
 * the gateway to expect a different amount than the real price), falling back to `lookup.amount`
 * for every other order (PayFast, Ozow with the flag off, any order predating this field) —
 * byte-identical to pre-F1 behaviour in every one of those cases.
 */
export function notificationAmountMatches(
  lookup: { amount: number; expectedGatewayAmount?: number | null },
  grossAmountCents: number | null
): boolean {
  const orderAmount = lookup.expectedGatewayAmount ?? lookup.amount;
  const orderAmountCents = Number.isNaN(orderAmount) ? null : Math.round(orderAmount * 100);
  if (grossAmountCents === null || orderAmountCents === null) return false;
  return Math.abs(grossAmountCents - orderAmountCents) < AMOUNT_MATCH_TOLERANCE_CENTS;
}

export async function POST(
  paymentProvider: PaymentProvider,
  request: NextRequest
): Promise<NextResponse> {
  const rawBody = await request.text();

  // 1-3. Verification. One call now covers what used to be three inline steps, in the same
  // order and with the same verdicts: the provider parses the posted body preserving posted
  // order, fails closed if its own credentials are unset BEFORE computing any digest,
  // authenticates the body against the shared secret, and only then resolves the source IP. A
  // failed authentication must never trigger the source-IP resolution — see the provider adapter
  // and contracts/checks/payment-seam-f1/check-inbound-verify.mjs case 7.
  const verification = await paymentProvider.verifyNotification({
    rawBody,
    headers: request.headers,
  });

  if (!verification.verified) {
    // Every rejection stays individually diagnosable: the reason code distinguishes an
    // unconfigured gateway from a missing credential, a failed authentication and a missing
    // reference, and the reference (when we have one) is what an operator reconciles by.
    console.error('[tickets/itn] Notification rejected before any order was touched', {
      provider: paymentProvider.id,
      reason: verification.reason,
      reference: verification.reference,
    });
    return acknowledge();
  }

  const { notification } = verification;
  const reference = notification.reference;

  // 4. Source IP — LOGGED, NOT ENFORCED (2026-08-18, carried forward unchanged). A real,
  // correctly-signed sandbox notification was observed arriving from a Google Cloud address
  // that is not among the IPs the gateway's published hostnames resolve to, so enforcing
  // this check was rejecting genuine, already-authenticated payments. Body authentication
  // (step 1, already passed by the time this runs) plus the server round-trip confirmation
  // (step 8, the gateway's own documented anti-spoofing mechanism) remain the actual
  // security boundary; source IP is defense-in-depth only and must never be able to reject
  // a payment those two already authenticated. The provider reports the fact; this route
  // decides what to do about it, which is: write it down and carry on.
  if (notification.sourceIpTrusted === false) {
    console.warn('[tickets/itn] Source IP not in the gateway host set (logged only, not rejecting)', {
      provider: paymentProvider.id,
      reference,
      sourceIp: notification.sourceIp,
    });
  } else if (notification.sourceIpTrusted === null) {
    console.warn('[tickets/itn] Could not determine client IP (logged only, not rejecting)', {
      provider: paymentProvider.id,
      reference,
    });
  }

  // 5. Order lookup. The order is the payment source of truth (F2, ticketing-foundation) —
  // look it up by the payment reference, not the position. This read is NOT transactional
  // (optimisation + amount-check only); the authoritative re-read + write happens inside
  // markOrderAndPositionPaidByPaymentId's own transaction below. See that function
  // (lib/orders.ts) for why this is safe under concurrent/duplicate notification delivery.
  let lookup: Awaited<ReturnType<typeof findReservedOrderByPaymentId>>;
  try {
    lookup = await findReservedOrderByPaymentId(reference);
  } catch (error) {
    console.error('[tickets/itn] Order lookup failed — rejecting notification', {
      provider: paymentProvider.id,
      reference,
      error,
    });
    return acknowledge();
  }

  if (lookup.status === 'not-found') {
    console.error('[tickets/itn] No order found for reference — rejecting notification', {
      provider: paymentProvider.id,
      reference,
    });
    return acknowledge();
  }

  // 6. Idempotency fast path (optimisation only, NOT the correctness guarantee): if this read
  // already shows anything other than 'reserved', there is no transition for this notification
  // to make, so skip the amount check and the external server-confirm round-trip. This read
  // is not transactional and can be stale under concurrent deliveries, so it must never be
  // relied on for the actual write decision — see the transactional status check inside
  // markOrderAndPositionPaidByPaymentId below.
  //
  // A non-'paid' short-circuit is logged, not silent: it means money may have moved for an
  // order this handler will not mark paid (a cancelled or malformed document), and the 200
  // below stops the gateway retrying. That is deliberate — fail closed on the write, loud in
  // the log, and let an operator reconcile — but it must be visible to reconcile.
  if (lookup.status === 'already-settled') {
    if (lookup.orderStatus !== 'paid') {
      console.error('[tickets/itn] Order is not reserved — ignoring notification, no status change', {
        provider: paymentProvider.id,
        reference,
        status: lookup.orderStatus,
      });
    }
    return acknowledge();
  }

  // 7. Amount match — the reserved order's server-derived amount must match what the gateway
  // says was actually charged. The provider translates its own decimal-string wire format into
  // integer cents (format translation, same category as mapStatus); judging whether that number
  // is acceptably close to our own stored figure is OUR decision and stays here. A provider that
  // decided whether an amount was acceptable would be deciding, on our behalf, whether we had
  // been paid.
  //
  // notificationAmountMatches() (above) is the pure comparison, extracted so it is testable
  // with zero I/O; it already implements the ozow-sandbox-toggle F1 (README §3b)
  // expectedGatewayAmount fallback.
  const grossAmount = notification.grossAmount;
  const grossAmountCents = notification.grossAmountCents;
  if (!notificationAmountMatches(lookup, grossAmountCents)) {
    console.error('[tickets/itn] Gross amount does not match reserved order — rejecting notification', {
      provider: paymentProvider.id,
      reference,
      grossAmount,
      orderAmount: lookup.expectedGatewayAmount ?? lookup.amount,
    });
    return acknowledge();
  }

  // 8. Server confirmation — the provider posts the received data back to the gateway's own
  // validation endpoint out of band and requires its documented affirmative response. This is
  // a separate interface member rather than part of step 1 precisely so that it stays HERE,
  // after the amount check and after the settled short-circuit, exactly where the pre-F2 route
  // performed it. Folding it into verification would fire a network call on notifications this
  // route has never confirmed.
  const confirmation = await paymentProvider.confirmNotification(notification);
  if (!confirmation.confirmed) {
    console.error('[tickets/itn] Server confirmation failed — rejecting notification', {
      provider: paymentProvider.id,
      reference,
      reason: confirmation.reason,
    });
    return acknowledge();
  }

  // 9. All prior checks passed. Only flip to 'paid' if the gateway also reports a settled,
  // successful payment. mapStatus is strict: exactly one gateway status maps to 'paid'.
  const status = paymentProvider.mapStatus(notification.rawStatus);
  if (status !== 'paid') {
    console.error('[tickets/itn] Payment status is not paid — leaving order reserved', {
      provider: paymentProvider.id,
      reference,
      status,
      rawStatus: notification.rawStatus,
    });
    return acknowledge();
  }

  // 10. Atomic idempotent order+position two-write. The gateway retries notification delivery
  // until it receives HTTP 200, and can genuinely deliver the same valid notification twice in
  // close succession. markOrderAndPositionPaidByPaymentId (lib/orders.ts) re-reads the order
  // fresh inside a single Firestore transaction, checks it is still 'reserved', and — only
  // then — writes 'paid' to BOTH the order and its one child position in that same transaction,
  // so whichever delivery commits first wins and a loser (duplicate delivery, or a genuine
  // concurrent notification) sees the now-'paid' order and no-ops instead of writing again.
  //
  // The input key below is a FIRESTORE DOCUMENT FIELD NAME, not a live gateway symbol: it is
  // the indexed column the orders collection has stored since F2 (ticketing-foundation) and the
  // key markOrderAndPositionPaidByPaymentId queries on the same payment reference. Renaming it
  // is a data migration, not a refactor, and is deliberately out of this feature's scope — see
  // the golden README "The one identifier the ban cannot remove yet".
  const outcome = await markOrderAndPositionPaidByPaymentId({
    m_payment_id: reference,
    gatewayPaymentId: notification.gatewayPaymentId,
    now: Timestamp.now(),
    // F2 (payment-provider-seam, orders-query-race-spec §3 "C") — step 5's lookup already
    // located this order by the same payment reference; pass its id through so the write path
    // resolves by ref instead of re-reading the orders index a second time.
    orderId: lookup.orderId,
    // F2 (ozow-payment-provider, Codex GPT-5.5 cross-model review, 2026-08-22) — this
    // notification is only ever allowed to settle an order that was created under THIS SAME
    // provider; see MarkOrderAndPositionPaidInput.expectedGateway for the full rationale.
    expectedGateway: paymentProvider.id,
  });

  if (!outcome.committed) {
    if (outcome.reason === 'order-payment-id-mismatch') {
      console.error(
        '[tickets/itn] Identity mismatch — the resolved order does not belong to this notification, order left untouched',
        { provider: paymentProvider.id, reference, reason: outcome.reason }
      );
    } else if (outcome.reason === 'order-gateway-mismatch') {
      console.error(
        '[tickets/itn] Gateway mismatch — order was created under a different provider, order left untouched',
        {
          provider: paymentProvider.id,
          reference,
          reason: outcome.reason,
          storedGateway: outcome.storedGateway,
          expectedGateway: outcome.expectedGateway,
        }
      );
    } else {
      console.error('[tickets/itn] Transactional order+position update did not commit', {
        provider: paymentProvider.id,
        reference,
        reason: outcome.reason,
      });
    }
    return acknowledge();
  }

  // 11. Post-commit confirmation email hookup. deliverConfirmationEmailAfterCommit isolates any
  // failure from this response: the payment is already committed above and must never be rolled
  // back, retried, or hidden behind a 5xx because a delivery receipt failed to send.
  await deliverConfirmationEmailAfterCommit(
    () =>
      sendConfirmationEmail({
        orderId: outcome.orderId,
        buyerEmail: outcome.buyerEmail,
        buyerName: outcome.buyerName,
        recoveryToken: outcome.recoveryToken,
        positions: outcome.positions,
      }),
    (error) => {
      console.error('[tickets/itn] Confirmation email failed — payment already committed, not rolled back', {
        provider: paymentProvider.id,
        reference,
        orderId: outcome.orderId,
        error,
      });
    }
  );

  return acknowledge();
}
