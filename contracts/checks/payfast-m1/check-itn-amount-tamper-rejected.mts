// A20 — behavioural proof that amount_gross is genuinely COMPARED to the reserved
// ticket's stored amount, not merely read. The old A20 (`grep "amount_gross"`) passes
// even if the field is read and never compared to anything — an amount-tampering hole.
//
// route.ts (post-F2, 2026-08-20) compares in integer ZAR cents:
//   grossAmountCents = parseAmountToCents(amount_gross)   // string parse, no float round-trip
//   orderAmountCents = Math.round(ticketAmount * 100)
//   reject if either side is unparseable, or
//     Math.abs(grossAmountCents - orderAmountCents) >= AMOUNT_MATCH_TOLERANCE_CENTS (1)
// i.e. reject on a cent-or-more difference, or on an amount string that doesn't parse as
// whole ZAR cents; accept only on an exact cents match. This replaced an earlier float
// comparison (`Math.abs(Number(amount_gross) - ticketAmount) >= 0.01`) that a Codex
// GPT-5.5 cross-model review found let a one-cent underpayment pass, due to float
// subtraction noise. This check exercises the tamper case, the exact-match case, the
// reject boundary (a diff of exactly one cent), and an unparseable-amount case —
// reading the actual comparison from the route rather than assuming it, per the task
// brief. There is no "just under tolerance" case: ZAR cents are the finest granularity
// the comparison operates on, so a diff of one cent IS the boundary in both directions.
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

    // Sub-cent amount -> must be REJECTED, not accepted.
    //
    // This case used to be BOUNDARY-ACCEPT, expecting 'paid': under the pre-F2 float
    // comparison (`Math.abs(Number(amount_gross) - ticketAmount) >= 0.01`),
    // Math.abs(Number('0.0099') - 0) is 0.0099, just under the 0.01 tolerance, so it was
    // accepted — that was itself the FLOAT-TOLERANCE BUG this route was rewritten to
    // remove (Codex GPT-5.5, 2026-08-20: the same float subtraction let a one-cent
    // underpayment, Math.abs(Number('0.02') - 0.03) = 0.009999999999999998, pass the
    // >= 0.01 rejection). This case is being CHANGED because the property changed, not
    // because it was failing — the pre-fix route really did accept '0.0099' here; see
    // the git history of this file for the prior assertion.
    //
    // Under the current integer-cents comparison (parseAmountToCents, AMOUNT_MATCH_
    // TOLERANCE_CENTS = 1) there is no "just under the tolerance" gap to test: ZAR has
    // no sub-cent unit, cents are the finest granularity, and adjacent cent values are
    // exactly 1 cent apart — already covered by BOUNDARY-REJECT above. What deserves its
    // own case now is the other side of the old bug: an amount string PayFast would never
    // legitimately send (more than two fraction digits) must fail closed rather than be
    // silently coerced by a float round-trip. parseAmountToCents's regex
    // (`^(\d+)(?:\.(\d{1,2}))?$`) rejects '0.0099' outright, returning null, which the
    // route treats as unparseable and refuses — the correct behaviour: an amount we
    // cannot confidently read as a whole-cents ZAR value must never be treated as a match.
    {
      const { bookingRef, ref } = await freshTicket('SUBCENT-REJECT', 0);
      await deliver(bookingRef, '0.0099');
      const after = await shared.readTicketById(ref.id);
      shared.assert(
        after?.status === 'reserved',
        `amount_gross '0.0099' (more than two fraction digits, unparseable as whole ZAR cents) against a reserved amount of 0 was accepted, got status '${after?.status}' — an unparseable amount must fail closed, not be coerced`
      );
    }
  }
);
