import { NextRequest, NextResponse } from 'next/server';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

import { initAdmin } from '@/lib/firebase-admin';
import type { PaymentProvider } from '@/lib/payments';
import {
  VENDOR_STAND_ORDERS_COLLECTION,
  parseVendorSubmissionIdFromStandOrderRef,
  parseAttemptIdFromStandOrderRef,
} from '@/lib/vendor-stand-orders';
import { VENDOR_SUBMISSIONS_COLLECTION } from '@/lib/vendor-submissions';
import { deliverConfirmationEmailAfterCommit } from '@/lib/confirmation-email';
import { sendVendorPaymentAdminNoticeEmail } from '@/lib/vendor-payment-admin-notice';
import { sendVendorPaymentConfirmationEmail } from '@/lib/vendor-payment-confirmation';

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

/** F2 (vendor-stand-payment-confirm-gate) -- a hung downstream email send must not block its
 *  sibling send or the gateway's 200 ack, now that the two sends below are fired concurrently.
 *  See contracts/golden/vendor-stand-payment-confirm-gate/README.md "Choosing the timeout
 *  value" for why 5000ms and why concurrency alone / a timeout alone are each insufficient. */
const EMAIL_SEND_TIMEOUT_MS = 5000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`email send timed out after ${ms}ms`));
    }, ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/** F5 (vendor-stand-payment-confirm-gate) -- best-effort log-hygiene redaction, NOT a general
 *  PII scrubber (see the golden README's "F5 -- what redaction is not"). Applied to caught
 *  mailer/provider error messages before they reach console.error, since those messages can
 *  embed the offending recipient's real email address at runtime. */
const EMAIL_ADDRESS_PATTERN = /[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)+/g;

function redactEmailAddresses(message: string): string {
  return message.replace(EMAIL_ADDRESS_PATTERN, '[redacted-email]');
}

/** G1 (vendor-flow-notifications) -- the businessName/contactPersonName/standOrderRef needed
 *  for the payment-received admin notice, captured from inside the transaction (the only place
 *  submissionRef's data is read) but sent strictly OUTSIDE it. See the module doc comment.
 *  F1 (vendor-payment-confirmation) widens this with contactEmail/boothSize/amount -- no
 *  second Firestore read is needed: boothSize/amount come from the `order` document this
 *  function already reads inside the transaction (order-time fields, no staleness question),
 *  while contactEmail comes from that SAME EXISTING submission read below (the vendor's
 *  CURRENT contact details, not a stale initiate-time snapshot). See
 *  contracts/contract-vendor-payment-confirmation.yaml's F1 "GROUND TRUTH CORRECTED" note. */
interface PaidNotice {
  businessName: string;
  contactPersonName: string;
  standOrderRef: string;
  contactEmail: string | null;
  boothSize: 1 | 2 | 3;
  amount: number;
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
    // F8 (vendor-stand-payment-confirm-gate) -- `verification.reference` is read straight off
    // an unsigned/malformed notification's wire field, before any parsing or ownership check --
    // it is entirely ATTACKER-CONTROLLED at this point and can embed an arbitrary string,
    // including a real or fabricated email address. Reuses F5's existing redaction helper (same
    // best-effort log-hygiene shape, no second way of doing the same thing) -- see the golden
    // README's "F8" for why this is a different fix site from F5's caught-mailer-error redaction.
    console.error('[vendors/stand-payment] Notification rejected before any order was touched', {
      provider: paymentProvider.id,
      reason: verification.reason,
      reference: verification.reference ? redactEmailAddresses(verification.reference) : verification.reference,
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
  // settlement transaction below (the only place submissionRef's data is read), but sent
  // strictly AFTER that transaction resolves.
  let paidNotice: PaidNotice | null = null;

  type StandOrder = { gateway?: string; status?: string; amount?: number; boothSize?: 1 | 2 | 3; attemptId?: string };

  // F6 -- everything below runs inside a nested, VOID-returning closure so every guard exit can
  // use a bare `return;` (mirroring the pre-F6 shape, where these same guards lived inside a
  // void-returning transaction callback) while POST itself still always acknowledges HTTP 200
  // exactly ONCE, at the very end (step 5 below, after the paidNotice email section) --
  // unchanged from this file's "always 200" contract.
  await settle();

  async function settle(): Promise<void> {
    // F6 (vendor-stand-payment-confirm-gate) -- fixes a defect IN F1's OWN fix. F1 originally
    // placed `paymentProvider.confirmNotification()` INSIDE `db.runTransaction(...)`, but
    // Firestore replays a transaction callback from scratch on write contention -- confirm is a
    // real external network call, not a Firestore operation, so a replay could genuinely confirm
    // on a discarded attempt and then see a transient failure on the committing retry, losing a
    // real payment silently and permanently while still acking HTTP 200. Fix: confirm now runs
    // EXACTLY ONCE, entirely OUTSIDE and BEFORE any Firestore transaction -- mirroring
    // lib/tickets-notification.ts's own step 5-8 shape (non-transactional lookup -> settled/
    // amount short-circuits -> confirm, once, no transaction open) rather than the sibling path's
    // exact code shape (see this file's module doc comment and the golden README's "Design
    // intent" for why one shared transaction body was originally chosen and why F6 changes that).
    // A Firestore retry can no longer re-invoke confirm at all, because confirm no longer runs
    // inside the retried section. The settlement transaction below RE-VERIFIES every one of these
    // same guards at write time (the actual correctness guarantee, since state can change between
    // this pre-read and the transaction -- e.g. a concurrent duplicate delivery) -- this
    // non-transactional pre-read is an optimisation that decides whether confirming is even worth
    // attempting, same relationship as lib/orders.ts's markOrderAndPositionPaidByPaymentId's own
    // re-check-then-write pattern. See the golden README's "F6" for the full decision record.
    const preReadSnapshot = await standOrderRef.get();
    if (!preReadSnapshot.exists) {
      console.error('[vendors/stand-payment] No stand order found for reference -- ignoring notification', {
        provider: paymentProvider.id,
        vendorSubmissionId,
      });
      return;
    }
    const preOrder = preReadSnapshot.data() as StandOrder | undefined;

    // Cross-gateway guard -- a payfast notification must never settle an order created under
    // Ozow, or vice versa. Same reasoning as lib/orders.ts's markOrderAndPositionPaidByPaymentId
    // expectedGateway check. Re-verified inside the transaction below.
    if (preOrder?.gateway !== paymentProvider.id) {
      console.error('[vendors/stand-payment] Gateway mismatch -- order left untouched', {
        provider: paymentProvider.id,
        vendorSubmissionId,
        storedGateway: preOrder?.gateway,
      });
      return;
    }

    // Idempotency -- a duplicate/replayed notification for an already-settled order (paid, failed,
    // or cancelled) no-ops before ever reaching a confirm round trip. Re-verified transactionally.
    if (preOrder?.status !== 'pending') {
      return;
    }

    // F3 (vendor-stand-payment-confirm-gate) -- attempt-identity guard, gating EVERY notification
    // treated as authoritative for this order (the 'paid' path below AND the 'failed'/'cancelled'
    // path further down alike) -- gating only the paid path would leave the stale-terminal-
    // notification poisoning path open, which is the whole defect. See the golden README's "F3"
    // for the full decision record.
    //
    // `order.attemptId` presence is the ONLY signal for the migration-window carve-out. Once an
    // order carries an attemptId, a notification with NO parseable suffix is exactly as much a
    // mismatch as one that parses but differs -- there is no fallback-accept. The reference is
    // entirely our own construction (buildVendorStandOrderReference) and is echoed back verbatim
    // by both PayFast and Ozow, so every legitimate post-fix notification always carries the real
    // attempt suffix minted at initiate time. A bare/no-suffix notification against an order that
    // HAS an attemptId is therefore never legitimate -- it is either a stale legacy-shaped replay
    // or a forged reference (vendorSubmissionId is not secret), and is rejected the same as a
    // disagreeing suffix. The carve-out survives only for orders that predate the fix and
    // therefore have no `attemptId` at all (order?.attemptId is falsy, so this whole branch never
    // runs and the notification is accepted unconditionally, i.e. today's exact pre-fix
    // behaviour, bounded to orders that predate the fix). See the golden README's "F3" for the
    // full decision record.
    if (preOrder?.attemptId) {
      const notificationAttemptId = parseAttemptIdFromStandOrderRef(notification.reference);
      if (notificationAttemptId !== preOrder.attemptId) {
        console.error(
          '[vendors/stand-payment] Notification belongs to a superseded payment attempt -- ignoring',
          { vendorSubmissionId },
        );
        return;
      }
    }

    if (status === 'paid') {
      const preOrderAmountCents = Number.isFinite(preOrder?.amount) ? Math.round(Number(preOrder?.amount) * 100) : null;
      // Amount guard -- the stored, server-derived amount is the ONLY thing ever compared
      // against; the notification's amount is never written anywhere as authoritative. Runs
      // BEFORE confirmNotification() so a tampered-amount notification never spends a real
      // gateway round trip -- re-verified transactionally below.
      if (
        preOrderAmountCents === null ||
        notification.grossAmountCents === null ||
        notification.grossAmountCents !== preOrderAmountCents
      ) {
        console.error('[vendors/stand-payment] Gross amount does not match stand order -- rejecting', {
          provider: paymentProvider.id,
          vendorSubmissionId,
          grossAmountCents: notification.grossAmountCents,
          orderAmountCents: preOrderAmountCents,
        });
        return;
      }

      // F1 (vendor-stand-payment-confirm-gate) -- the gateway's own out-of-band server-confirm
      // round trip (PayFast's /eng/query/validate, Ozow's GetTransactionByReference), mirroring
      // lib/tickets-notification.ts's own step 8. Signature verification alone (step 1) proves a
      // notification was signed with the shared secret -- it does not prove the gateway itself
      // processed a real payment. This check is deliberately reason-agnostic: there is no
      // ConfirmResult reason ('not-valid', 'request-failed', 'not-configured') that means "trust
      // the inbound signature instead" -- see the golden README's "Fail-closed semantics". F6
      // moves this call to run exactly ONCE, here, before any transaction -- see this block's
      // opening comment.
      const confirmation = await paymentProvider.confirmNotification(notification);
      if (!confirmation.confirmed) {
        console.error('[vendors/stand-payment] Server confirmation failed -- rejecting notification', {
          provider: paymentProvider.id,
          vendorSubmissionId,
          reason: confirmation.reason,
        });
        return;
      }

      // F6 -- ONE Firestore transaction that RE-VERIFIES every guard above at write time (state
      // can have changed since the non-transactional pre-read, e.g. a concurrent duplicate
      // delivery already settled this order) and performs the write. confirmNotification() is
      // NEVER called in here -- its result was already obtained, for real, exactly once, above; a
      // Firestore retry replaying this callback re-checks state and re-applies the SAME already-
      // obtained confirmation, it does not re-ask the gateway.
      await db.runTransaction(async (transaction) => {
        // Per-attempt reset -- must run before any read or branch, since Firestore replays this
        // entire callback from scratch on every contention retry.
        paidNotice = null;

        const orderDoc = await transaction.get(standOrderRef);
        const order = orderDoc.data() as StandOrder | undefined;
        if (
          !orderDoc.exists ||
          order?.gateway !== paymentProvider.id ||
          order?.status !== 'pending'
        ) {
          return;
        }
        if (order?.attemptId) {
          const notificationAttemptId = parseAttemptIdFromStandOrderRef(notification.reference);
          if (notificationAttemptId !== order.attemptId) {
            return;
          }
        }
        const orderAmountCents = Number.isFinite(order?.amount) ? Math.round(Number(order?.amount) * 100) : null;
        if (
          orderAmountCents === null ||
          notification.grossAmountCents === null ||
          notification.grossAmountCents !== orderAmountCents
        ) {
          return;
        }

        // G1 (vendor-flow-notifications) -- read BEFORE the first write in this transaction
        // (Firestore requires every transaction.get() to precede every transaction.set/update/
        // delete in the same transaction).
        const submissionDoc = await transaction.get(submissionRef);
        const submission = submissionDoc.data() as
          | { businessName?: string; contactPersonName?: string; contactEmail?: string }
          | undefined;
        if (submission?.businessName && submission.contactPersonName) {
          // F1 (vendor-payment-confirmation) -- boothSize/amount are order-time fields (chosen
          // at /api/vendors/stand-payment/initiate) that are never present on `submission`, so
          // `order` is their only correct source. The amount guard above already proves
          // `order.amount` is a real, finite, currently-settling amount; `order.boothSize` is
          // written by that same initiate transaction alongside `amount` and never mutated
          // before settlement, so it narrows a same-guaranteed field, not unrelated data.
          const orderBoothSize = order?.boothSize as 1 | 2 | 3;
          const orderAmount = order?.amount as number;
          // contactEmail is sourced from `submission`, NOT `order` -- `submission` reflects the
          // vendor's CURRENT contact details, while `order.contactEmail` is only a snapshot
          // copied at initiate time and can go stale between initiate and settlement. Trimmed
          // and coalesced to null (never an empty string masquerading as a real address) so a
          // missing/blank contactEmail is diagnosable downstream without ever crashing here.
          const contactEmail = submission.contactEmail?.trim() || null;
          paidNotice = {
            businessName: submission.businessName,
            contactPersonName: submission.contactPersonName,
            standOrderRef: notification.reference,
            contactEmail,
            boothSize: orderBoothSize,
            amount: orderAmount,
          };
        } else {
          // F4 (vendor-stand-payment-confirm-gate) -- settlement continues unchanged below (money
          // already moved; refusing to settle would be worse), but the skip must not be silent.
          // Same "vendorSubmissionId only, never a submitted field" shape as the existing
          // missing-contactEmail else branch further down this file.
          console.error(
            '[vendors/stand-payment] Paid order settled but submission is missing businessName/contactPersonName -- no confirmation emails sent',
            { vendorSubmissionId },
          );
        }

        const now = Timestamp.now();
        transaction.update(standOrderRef, {
          status: 'paid',
          paidAt: now,
          gatewayPaymentId: notification.gatewayPaymentId,
        });
        transaction.update(submissionRef, { paymentReceived: true });
      });
    } else if (status === 'failed' || status === 'cancelled') {
      // F6 -- no confirm call on this path (unchanged scope, see the golden README's "F1" /
      // "Interaction..." note: the confirm gate only ever applied to the 'paid' write). Still
      // transactional, and still re-verifies the same guards at write time.
      await db.runTransaction(async (transaction) => {
        const orderDoc = await transaction.get(standOrderRef);
        const order = orderDoc.data() as StandOrder | undefined;
        if (
          !orderDoc.exists ||
          order?.gateway !== paymentProvider.id ||
          order?.status !== 'pending'
        ) {
          return;
        }
        if (order?.attemptId) {
          const notificationAttemptId = parseAttemptIdFromStandOrderRef(notification.reference);
          if (notificationAttemptId !== order.attemptId) {
            return;
          }
        }
        transaction.update(standOrderRef, { status, failedAt: Timestamp.now() });
      });
    } else {
      console.error('[vendors/stand-payment] Notification status is not actionable -- leaving order pending', {
        provider: paymentProvider.id,
        vendorSubmissionId,
        status,
        rawStatus: notification.rawStatus,
      });
    }
  }

  // 5. G1 (vendor-flow-notifications) -- fired STRICTLY OUTSIDE the transaction above, once,
  // wrapped in the REAL deliverConfirmationEmailAfterCommit so a failed send never blocks the
  // gateway's 200 acknowledgement.
  if (paidNotice) {
    // Captured into a const so the closure below (which TypeScript cannot narrow through, since
    // `paidNotice` is an outer `let`) always sees the non-null value proven by this `if`.
    const notice: PaidNotice = paidNotice;

    // F2 (vendor-stand-payment-confirm-gate) -- both sends below are built as promises first,
    // then awaited together via Promise.allSettled, so a hung send cannot block its sibling or
    // the gateway's 200 ack. Each send is individually bounded by withTimeout() and its own
    // rejection is already caught by deliverConfirmationEmailAfterCommit's onError -- neither
    // promise here should itself reject.
    const adminNoticePromise = deliverConfirmationEmailAfterCommit(
      () =>
        withTimeout(
          sendVendorPaymentAdminNoticeEmail({
            businessName: notice.businessName,
            contactPersonName: notice.contactPersonName,
            standOrderRef: notice.standOrderRef,
            reviewUrl: `${resolveSiteUrl()}/admin/vendors`,
          }),
          EMAIL_SEND_TIMEOUT_MS,
        ),
      (error) => {
        // F5 (vendor-stand-payment-confirm-gate) -- redact before logging: a caught mailer
        // error's message can embed a real recipient email address at runtime.
        console.error(
          '[vendors/stand-payment] Payment admin notice email failed (non-fatal):',
          error instanceof Error ? redactEmailAddresses(error.message) : 'unknown error',
        );
      },
    );

    // F1 (vendor-payment-confirmation) -- the NEW vendor-facing receipt, independently wrapped
    // and fired inside the SAME `if (paidNotice)` block as the admin notice above (not a
    // second, separately-gated `if`) so it inherits the exact same idempotency guarantee. A
    // submission missing/blank contactEmail must never suppress the admin notice above -- it
    // only skips this vendor send, logging just the vendorSubmissionId (never a submitted
    // field) so the gap is diagnosable without becoming a second PII leak.
    const noticeContactEmail = notice.contactEmail;
    const vendorReceiptPromise = noticeContactEmail
      ? deliverConfirmationEmailAfterCommit(
          () =>
            withTimeout(
              sendVendorPaymentConfirmationEmail({
                businessName: notice.businessName,
                contactEmail: noticeContactEmail,
                boothSize: notice.boothSize,
                amount: notice.amount,
                standOrderRef: notice.standOrderRef,
              }),
              EMAIL_SEND_TIMEOUT_MS,
            ),
          (error) => {
            // F5 (vendor-stand-payment-confirm-gate) -- redact before logging, same reasoning
            // as the admin-notice onError above.
            console.error(
              '[vendors/stand-payment] Vendor payment confirmation email failed (non-fatal):',
              error instanceof Error ? redactEmailAddresses(error.message) : 'unknown error',
            );
          },
        )
      : (() => {
          console.error(
            '[vendors/stand-payment] Paid submission has no contactEmail -- vendor payment receipt not sent',
            { vendorSubmissionId },
          );
          return Promise.resolve();
        })();

    await Promise.allSettled([adminNoticePromise, vendorReceiptPromise]);
  }

  return acknowledge();
}
