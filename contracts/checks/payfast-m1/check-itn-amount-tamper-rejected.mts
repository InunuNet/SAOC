// A20 — behavioural proof that amount_gross is genuinely COMPARED to the reserved
// ticket's stored amount, not merely read. The old A20 (`grep "amount_gross"`) passes
// even if the field is read and never compared to anything — an amount-tampering hole.
//
// route.ts compares with:
//   Math.abs(Number(amount_gross) - ticketAmount) >= AMOUNT_MATCH_TOLERANCE (0.01)
// i.e. reject on >=, accept below. This check exercises the tamper case, the match
// case, and both sides of that exact boundary — reading the operator from the route
// rather than assuming it, per the task brief.
//
// CREDENTIALS: LOCAL-ONLY — see check-itn-atomic-idempotent-write.mts's header comment.

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

const ASSERTION_ID = 'A20';
const TICKET_AMOUNT = 250;

if (!credentialsAvailable()) skipForMissingCredentials(ASSERTION_ID);

const shared = await import('../ticketing-hardening/_shared.mjs');

await shared.withCleanup(
  `${ASSERTION_ID} amount_gross is compared to the reserved ticket's stored amount, tolerance-exact`,
  async () => {
    const POST = await loadItnPost();
    const realIp = await realPayfastIp();
    const xff = buildXff(realIp);
    const id = shared.runId();

    async function freshTicket(label, amount = TICKET_AMOUNT) {
      const bookingRef = `PFM1-A20-${label}-${id}`;
      const ref = await createOrderAndPosition({
        bookingRef,
        attendeeEmail: shared.sentinelEmail(`a20-${label.toLowerCase()}-${id}`),
        amount,
      });
      return { bookingRef, ref };
    }

    async function deliver(bookingRef, amountGross) {
      const fields = itnFields({ mPaymentId: bookingRef, amountGross });
      const body = await signAndEncode(fields);
      const request = buildItnRequest({ body, xff });
      await withFetchStub(confirmStub('VALID'), () => POST(request));
    }

    // Gross tamper: amount_gross wildly below the reserved amount -> must stay reserved.
    {
      const { bookingRef, ref } = await freshTicket('TAMPER');
      await deliver(bookingRef, '1.00');
      const after = await shared.readTicketById(ref.id);
      shared.assert(
        after?.status === 'reserved',
        `amount_gross '1.00' against a reserved amount of ${TICKET_AMOUNT} still resulted in status '${after?.status}' — amount is not enforced`
      );
    }

    // Exact match -> paid.
    {
      const { bookingRef, ref } = await freshTicket('MATCH');
      await deliver(bookingRef, '250.00');
      const after = await shared.readTicketById(ref.id);
      shared.assert(after?.status === 'paid', `an exact amount match still resulted in status '${after?.status}'`);
    }

    // Boundary: diff exactly AMOUNT_MATCH_TOLERANCE (0.01) -> route uses `>=`, so this
    // must still be REJECTED. Uses a ticket amount of 0 deliberately: Number('0.01') - 0
    // is the SAME double as the route's own `0.01` literal (no floating-point
    // subtraction rounding introduced by combining two non-trivial decimals — verified
    // '250.01' - 250 !== 0.01 as a double, so that pairing cannot test this boundary
    // honestly). This is the boundary the tolerance constant actually draws.
    {
      const { bookingRef, ref } = await freshTicket('BOUNDARY-REJECT', 0);
      await deliver(bookingRef, '0.01');
      const after = await shared.readTicketById(ref.id);
      shared.assert(
        after?.status === 'reserved',
        `amount_gross '0.01' against a reserved amount of 0 (diff exactly the 0.01 tolerance) was accepted — the comparison must reject at >= tolerance, got status '${after?.status}'`
      );
    }

    // Boundary: diff just under tolerance -> must be ACCEPTED. Same amount-0 pairing for
    // the same floating-point-honesty reason as above.
    {
      const { bookingRef, ref } = await freshTicket('BOUNDARY-ACCEPT', 0);
      await deliver(bookingRef, '0.0099');
      const after = await shared.readTicketById(ref.id);
      shared.assert(
        after?.status === 'paid',
        `amount_gross '0.0099' against a reserved amount of 0 (diff 0.0099, just under the 0.01 tolerance) was rejected, got status '${after?.status}'`
      );
    }
  }
);
