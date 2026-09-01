import { NextRequest, NextResponse } from 'next/server';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

import { initAdmin } from '@/lib/firebase-admin';
import type { PaymentProvider } from '@/lib/payments';
import {
  VENDOR_STAND_ORDERS_COLLECTION,
  parseVendorSubmissionIdFromStandOrderRef,
} from '@/lib/vendor-stand-orders';
import { VENDOR_SUBMISSIONS_COLLECTION } from '@/lib/vendor-submissions';
import { deliverConfirmationEmailAfterCommit } from '@/lib/confirmation-email';
import { sendVendorPaymentAdminNoticeEmail } from '@/lib/vendor-payment-admin-notice';

/**
 * Vendor stand-payment notification handler -- SECURITY BOUNDARY, FAIL CLOSED (mission
 * vendor-gated-registration-flow, M3/F31). Mirrors lib/tickets-notification.ts's shape:
 * shared by two thin per-gateway routes (payfast-itn, ozow-itn) so neither route names the
 * other's provider. See contracts/golden/vendor-gated-registration-flow-m3/README.md
 * "Settlement -- one shared handler, two thin per-gateway routes, full idempotency" for the
 * full decision record and step ordering, which is load-bearing.
 *
 * Every check below must pass before a vendorStandOrders doc is ever flipped to 'paid'. Any
 * single failure logs which check failed and leaves both documents untouched -- we still
 * return HTTP 200 so the gateway stops retrying, but a 200 response here never implies the
 * payment was accepted.
 */

/** Always 200 -- the gateway must stop retrying regardless of validation outcome. */
function acknowledge(): NextResponse {
  return NextResponse.json({ received: true }, { status: 200 });
}

/** Site URL fallback, matching lib/confirmation-email.ts's own DEFAULT_SITE_URL convention --
 *  duplicated locally rather than imported (that fallback is private to its own module and
 *  SITE_URL is runtime-only, not available at build time). G1 (vendor-flow-notifications). */
const DEFAULT_SITE_URL = 'https://saoc.co.za';

function resolveSiteUrl(): string {
  return process.env['SITE_URL'] ?? DEFAULT_SITE_URL;
}

/** G1 (vendor-flow-notifications) -- the businessName/contactPersonName/standOrderRef needed
 *  for the payment-received admin notice, captured from inside the transaction (the only place
 *  submissionRef's data is read) but sent strictly OUTSIDE it. See the module doc comment. */
interface PaidNotice {
  businessName: string;
  contactPersonName: string;
  standOrderRef: string;
}

export interface VendorStandPaymentNotificationDeps {
  db?: ReturnType<typeof getFirestore>;
}

export async function POST(
  paymentProvider: PaymentProvider,
  request: NextRequest,
  deps: VendorStandPaymentNotificationDeps = {},
): Promise<NextResponse> {
  const rawBody = await request.text();

  // 1. Verification -- the provider parses the posted body, fails closed if its own
  // credentials are unset, and authenticates the body against the shared secret.
  const verification = await paymentProvider.verifyNotification({ rawBody, headers: request.headers });
  if (!verification.verified) {
    console.error('[vendors/stand-payment] Notification rejected before any order was touched', {
      provider: paymentProvider.id,
      reason: verification.reason,
      reference: verification.reference,
    });
    return acknowledge();
  }

  const { notification } = verification;

  // 2. Parse vendorSubmissionId out of the reference by stripping the fixed 'VSO-' prefix.
  // Malformed/missing -> log, no-op. This is what tells us this notification belongs to a
  // STAND booking, not a ticket order -- a ticket order's m_payment_id never carries this
  // prefix, so a notification meant for the ticket ITN route arriving here (or vice versa)
  // is refused here rather than misparsed.
  const vendorSubmissionId = parseVendorSubmissionIdFromStandOrderRef(notification.reference);
  if (!vendorSubmissionId) {
    console.error('[vendors/stand-payment] Reference is not a stand-order reference -- ignoring', {
      provider: paymentProvider.id,
      reference: notification.reference,
    });
    return acknowledge();
  }

  // 3. Translate the gateway's own status vocabulary ONCE, offline -- pure, no I/O.
  const status = paymentProvider.mapStatus(notification.rawStatus);

  const db = deps.db ?? getFirestore(initAdmin());
  const standOrderRef = db.collection(VENDOR_STAND_ORDERS_COLLECTION).doc(vendorSubmissionId);
  const submissionRef = db.collection(VENDOR_SUBMISSIONS_COLLECTION).doc(vendorSubmissionId);

  // G1 (vendor-flow-notifications) -- assigned only on the 'paid' path, from inside the
  // transaction (the only place submissionRef's data is read), but sent strictly AFTER the
  // transaction resolves. Firestore re-invokes this callback from scratch on every contention
  // retry, so `paidNotice` is reset to null at the TOP of every attempt (see below) -- an
  // attempt that early-returns or takes a non-'paid' branch can never inherit a stale non-null
  // value left over from an earlier, aborted attempt.
  let paidNotice: PaidNotice | null = null;

  // 4. ONE Firestore transaction touching BOTH documents -- both-or-neither, same reasoning
  // as lib/checkout-reservation.ts's writeReservationPair.
  await db.runTransaction(async (transaction) => {
    // Per-attempt reset -- must run before any read or branch, since Firestore replays this
    // entire callback from scratch on every contention retry (see the comment on the outer
    // `paidNotice` declaration above).
    paidNotice = null;

    const orderDoc = await transaction.get(standOrderRef);
    if (!orderDoc.exists) {
      console.error('[vendors/stand-payment] No stand order found for reference -- ignoring notification', {
        provider: paymentProvider.id,
        vendorSubmissionId,
      });
      return;
    }
    const order = orderDoc.data() as
      | { gateway?: string; status?: string; amount?: number }
      | undefined;

    // Cross-gateway guard -- a payfast notification must never settle an order created under
    // Ozow, or vice versa. Same reasoning as lib/orders.ts's markOrderAndPositionPaidByPaymentId
    // expectedGateway check.
    if (order?.gateway !== paymentProvider.id) {
      console.error('[vendors/stand-payment] Gateway mismatch -- order left untouched', {
        provider: paymentProvider.id,
        vendorSubmissionId,
        storedGateway: order?.gateway,
      });
      return;
    }

    // Idempotency -- a duplicate/replayed notification for an already-settled order (paid,
    // failed, or cancelled) no-ops. No second write of any kind, not even a re-set of an
    // identical value.
    if (order?.status !== 'pending') {
      return;
    }

    if (status === 'paid') {
      const orderAmountCents = Number.isFinite(order?.amount) ? Math.round(Number(order?.amount) * 100) : null;
      // Amount guard -- the stored, server-derived amount is the ONLY thing ever compared
      // against; the notification's amount is never written anywhere as authoritative.
      if (
        orderAmountCents === null ||
        notification.grossAmountCents === null ||
        notification.grossAmountCents !== orderAmountCents
      ) {
        console.error('[vendors/stand-payment] Gross amount does not match stand order -- rejecting', {
          provider: paymentProvider.id,
          vendorSubmissionId,
          grossAmountCents: notification.grossAmountCents,
          orderAmountCents,
        });
        return;
      }

      // G1 (vendor-flow-notifications) -- read BEFORE the first write in this transaction
      // (Firestore requires every transaction.get() to precede every transaction.set/update/
      // delete in the same transaction).
      const submissionDoc = await transaction.get(submissionRef);
      const submission = submissionDoc.data() as
        | { businessName?: string; contactPersonName?: string }
        | undefined;
      if (submission?.businessName && submission.contactPersonName) {
        paidNotice = {
          businessName: submission.businessName,
          contactPersonName: submission.contactPersonName,
          standOrderRef: notification.reference,
        };
      }

      const now = Timestamp.now();
      transaction.update(standOrderRef, {
        status: 'paid',
        paidAt: now,
        gatewayPaymentId: notification.gatewayPaymentId,
      });
      transaction.update(submissionRef, { paymentReceived: true });
      return;
    }

    if (status === 'failed' || status === 'cancelled') {
      transaction.update(standOrderRef, { status, failedAt: Timestamp.now() });
      return;
    }

    console.error('[vendors/stand-payment] Notification status is not actionable -- leaving order pending', {
      provider: paymentProvider.id,
      vendorSubmissionId,
      status,
      rawStatus: notification.rawStatus,
    });
  });

  // 5. G1 (vendor-flow-notifications) -- fired STRICTLY OUTSIDE the transaction above, once,
  // wrapped in the REAL deliverConfirmationEmailAfterCommit so a failed send never blocks the
  // gateway's 200 acknowledgement.
  if (paidNotice) {
    // Captured into a const so the closure below (which TypeScript cannot narrow through, since
    // `paidNotice` is an outer `let`) always sees the non-null value proven by this `if`.
    const notice: PaidNotice = paidNotice;
    await deliverConfirmationEmailAfterCommit(
      () =>
        sendVendorPaymentAdminNoticeEmail({
          ...notice,
          reviewUrl: `${resolveSiteUrl()}/admin/vendors`,
        }),
      (error) => {
        console.error(
          '[vendors/stand-payment] Payment admin notice email failed (non-fatal):',
          error instanceof Error ? error.message : 'unknown error',
        );
      },
    );
  }

  return acknowledge();
}
