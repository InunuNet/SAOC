// A34 (S4) — REGRESSION GUARD, and honest about what it can and cannot prove.
//
// WHAT IT ASSERTS: after a genuine-looking, correctly signed ITN is delivered for a
// ticket that has already been checked in, the ticket is still 'checked-in', its
// checkedInAt audit timestamp is untouched, and the door still refuses re-admission for
// that booking reference.
//
// WHAT IT CANNOT PROVE: it is GREEN before the fix as well as after. An ITN issued from
// this gate dies at the source-IP gate (app/api/tickets/itn/route.ts step 2 resolves
// PayFast's published hosts via DNS) and, past that, at the server-confirm gate — which
// only returns 'VALID' for a payment PayFast actually processed. The write path is
// therefore unreachable from the gate in either direction, so this check cannot
// discriminate the fixed route from the broken one.
//
// The discriminating proof for S4 is A33 (byte-exact diff against the expected file) and
// A15 (its re-pinned hash). The one way to make S4 behaviourally testable would be to
// make PAYFAST_SANDBOX_VALIDATE_URL environment-overridable, which puts a test hook
// inside a payment security boundary — explicitly rejected in
// contracts/golden/ticketing-hardening/itn-write-guard.golden.md.
//
// This check earns its place anyway: it fails if any future change lets the same booking
// reference open the door twice, whatever the route to that state.

import { loadCheckin, shared } from './_checkin-harness.mts';

const s = await shared();
const { generateSignature } = await import('@/lib/payfast');

const ITN_FIELD_ORDER_NOTE =
  'field order is the signature base string order — PayFast spec, attribute order, not alphabetical';

await s.withCleanup(
  'A34 a replayed ITN does not resurrect a checked-in ticket or re-admit it',
  async () => {
    const { checkInByBookingRef } = await loadCheckin();
    const id = s.runId();
    const bookingRef = `HARDEN2-ITN-${id}`;

    const ref = await s.createTicketDoc({
      bookingRef,
      attendeeEmail: s.sentinelEmail(`itn-replay-${id}`),
      status: 'paid',
      purchasedAt: new Date(),
      amount: 0,
    });

    const admitted = await checkInByBookingRef(bookingRef);
    s.assert(
      admitted.ok === true,
      `PRECONDITION: the paid ticket must admit once before the replay, got ${JSON.stringify(admitted)}`
    );
    const before = await s.readTicketById(ref.id);
    const stampBefore = before?.checkedInAt?.toMillis?.() ?? null;
    s.assert(stampBefore != null, 'PRECONDITION: checkedInAt was not stamped');

    // A correctly signed duplicate notification for a payment PayFast already delivered.
    // ITN_FIELD_ORDER_NOTE applies to this object literal.
    const fields: Record<string, string> = {
      m_payment_id: bookingRef,
      pf_payment_id: `harden2-${id}`,
      payment_status: 'COMPLETE',
      item_name: 'SAOC 2027 National Show Ticket',
      amount_gross: '0.00',
    };
    const signature = generateSignature(fields, process.env.PAYFAST_SANDBOX_PASSPHRASE);
    const body = new URLSearchParams({ ...fields, signature }).toString();

    const res = await fetch(`${s.BASE_URL}/api/tickets/itn`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    s.assert(
      res.status === 200,
      `the ITN endpoint must always acknowledge 200 so PayFast stops retrying, got ${res.status} (${ITN_FIELD_ORDER_NOTE})`
    );

    const after = await s.readTicketById(ref.id);
    s.assert(
      after?.status === 'checked-in',
      `a replayed ITN reset a checked-in ticket to '${after?.status}'. lib/checkin.ts refuses re-admission solely on status === 'checked-in', so that booking reference now opens the door a second time.`
    );
    s.assert(
      (after?.checkedInAt?.toMillis?.() ?? null) === stampBefore,
      'a replayed ITN rewrote the checkedInAt audit timestamp'
    );

    const rescan = await checkInByBookingRef(bookingRef);
    s.assert(
      rescan.ok === false && rescan.code === 'already-checked-in',
      `after the replayed ITN the door admitted the same reference again: ${JSON.stringify(rescan)}`
    );
  }
);
