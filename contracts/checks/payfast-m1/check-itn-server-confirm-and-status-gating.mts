// A19/A21 — behavioural proof that the server-confirm response is actually consumed
// (not fetched-and-ignored) and that only `payment_status: 'COMPLETE'` flips a ticket to
// paid, with pf_payment_id persisted exactly as posted (not blank, not disconnected from
// the field that arrived).
//
// The old A19 (`grep "/eng/query/validate" && grep "VALID"`) and A21
// (`grep "COMPLETE" && grep "paid" && grep "pf_payment_id"`) each match on unrelated,
// disconnected occurrences — a fetch whose response is discarded, or "COMPLETE" only in
// a comment, both pass. This check drives four real scenarios through the route's actual
// POST() handler (see _itn-harness.mts for how the source-IP and server-confirm gates
// are both genuinely satisfiable in process) and reads Firestore back after each.
//
// CREDENTIALS: LOCAL-ONLY — see the header comment on
// check-itn-atomic-idempotent-write.mts for why (RUNTIME-only secrets, absent from CI).

import {
  credentialsAvailable,
  skipForMissingCredentials,
  realPayfastIp,
  buildXff,
  buildItnRequest,
  loadItnPost,
  withFetchStub,
  confirmStub,
  itnFields,
  signAndEncode,
  createOrderAndPosition,
} from './_itn-harness.mts';
import { PAYFAST_SANDBOX_VALIDATE_URL } from '@/lib/payfast';

const ASSERTION_ID = 'A19/A21';

if (!credentialsAvailable()) skipForMissingCredentials(ASSERTION_ID);

const shared = await import('../ticketing-hardening/_shared.mjs');

await shared.withCleanup(
  `${ASSERTION_ID} server-confirm response gates the write, and status/pf_payment_id are correctly connected`,
  async () => {
    const POST = await loadItnPost();
    const realIp = await realPayfastIp();
    const xff = buildXff(realIp);
    const id = shared.runId();

    async function freshTicket(label) {
      const bookingRef = `PFM1-A1921-${label}-${id}`;
      const ref = await createOrderAndPosition({
        bookingRef,
        attendeeEmail: shared.sentinelEmail(`a1921-${label.toLowerCase()}-${id}`),
        amount: 250,
      });
      return { bookingRef, ref };
    }

    // (a) confirm returns INVALID -> stays reserved, and the stub was genuinely called
    // (proves the response isn't fetched-and-ignored).
    {
      const { bookingRef, ref } = await freshTicket('INVALID');
      const fields = itnFields({ mPaymentId: bookingRef, amountGross: '250.00' });
      const body = await signAndEncode(fields);
      const request = buildItnRequest({ body, xff });
      const { calls } = await withFetchStub(confirmStub('INVALID'), () => POST(request));
      shared.assert(calls.length === 1, `expected exactly one server-confirm fetch call, got ${calls.length}`);
      shared.assert(
        calls[0][0] === PAYFAST_SANDBOX_VALIDATE_URL,
        `server-confirm fetch was not called with PAYFAST_SANDBOX_VALIDATE_URL, got ${String(calls[0][0])}`
      );
      const after = await shared.readTicketById(ref.id);
      shared.assert(
        after?.status === 'reserved',
        `a server-confirm response of 'INVALID' still resulted in status '${after?.status}'`
      );
    }

    // (b) confirm returns VALID but payment_status is PENDING -> stays reserved.
    {
      const { bookingRef, ref } = await freshTicket('PENDING');
      const fields = itnFields({ mPaymentId: bookingRef, amountGross: '250.00', paymentStatus: 'PENDING' });
      const body = await signAndEncode(fields);
      const request = buildItnRequest({ body, xff });
      await withFetchStub(confirmStub('VALID'), () => POST(request));
      const after = await shared.readTicketById(ref.id);
      shared.assert(
        after?.status === 'reserved',
        `payment_status 'PENDING' with a VALID confirm still resulted in status '${after?.status}'`
      );
    }

    // (c) confirm VALID + COMPLETE -> paid, and pf_payment_id matches exactly what was
    // posted (not blank, not a different value — proves the fields are actually wired
    // together, not three independent matches).
    {
      const { bookingRef, ref } = await freshTicket('COMPLETE');
      const pfPaymentId = `pfm1-complete-${id}`;
      const fields = itnFields({
        mPaymentId: bookingRef,
        amountGross: '250.00',
        paymentStatus: 'COMPLETE',
        pfPaymentId,
      });
      const body = await signAndEncode(fields);
      const request = buildItnRequest({ body, xff });
      await withFetchStub(confirmStub('VALID'), () => POST(request));
      const after = await shared.readTicketById(ref.id);
      shared.assert(after?.status === 'paid', `COMPLETE + VALID did not mark the ticket paid: '${after?.status}'`);
      // F10/F4: gatewayPaymentId (the pf_payment_id equivalent) is written onto the
      // ORDER by markOrderAndPositionPaidByPaymentId, not onto the position — the order
      // is the payment source of truth post-F10 (lib/orders.ts:302), and the position's
      // own pf_payment_id field is not duplicated by that write. See the golden README's
      // fixture-strategy note on buildReservationDocs/lib/orders.ts's field ownership.
      const orderDoc = await shared.db().collection('orders').doc(after?.orderId).get();
      shared.assert(orderDoc.exists, `no order document found at orderId '${after?.orderId}'`);
      shared.assert(
        orderDoc.data()?.['gatewayPaymentId'] === pfPaymentId,
        `order.gatewayPaymentId was not persisted as posted: expected '${pfPaymentId}', got '${orderDoc.data()?.['gatewayPaymentId']}'`
      );
    }

    // (d) confirm body is 'VALIDx' (trailing content) -> must be rejected. Proves an
    // exact-match comparison, not a substring/prefix check.
    {
      const { bookingRef, ref } = await freshTicket('VALIDX');
      const fields = itnFields({ mPaymentId: bookingRef, amountGross: '250.00' });
      const body = await signAndEncode(fields);
      const request = buildItnRequest({ body, xff });
      await withFetchStub(confirmStub('VALIDx'), () => POST(request));
      const after = await shared.readTicketById(ref.id);
      shared.assert(
        after?.status === 'reserved',
        `a server-confirm body of 'VALIDx' (not an exact 'VALID' match) still resulted in status '${after?.status}'`
      );
    }
  }
);
