// A30/A31 — behavioural proof of atomic, idempotent ITN writes.
//
// Companion to check-paid-write-inside-transaction-scope.mjs (the AST/structural proof
// of the same claim). That check proves the SHAPE of the code; this one proves the
// OBSERVABLE BEHAVIOUR. See contracts/checks/payfast-m1/_itn-harness.mts's header
// comment for how this reaches the real write path in process (direct POST() import,
// real DNS-resolved source IP, stubbed server-confirm fetch) without needing a running
// dev server or a real PayFast-originated request.
//
// WHY THIS IS A RACE, NOT A SIMPLE SEQUENTIAL REPLAY (important correction versus the
// first draft of this check, kept here so nobody "fixes" it back)
// route.ts has TWO guards, not one: a non-transactional "fast path" read near the top
// (`if (currentStatus !== RESERVED_STATUS) { ... return; }`), and the transactional
// re-read inside db.runTransaction that A31 actually names. A sequential replay — call
// the route, wait for it to fully finish and commit 'paid', THEN call it again with the
// identical body — is caught entirely by the FAST PATH: the second call's outer,
// non-transactional read already sees 'paid' and returns before ever reaching the
// amount check, the server-confirm fetch, or the transaction. Proved empirically: with
// the transaction's inner re-check deliberately disabled (dropping the
// `freshSnapshot.data()?.['status'] !== RESERVED_STATUS` guard down to `if (false)`), a
// sequential-replay version of this check still PASSED — it was not exercising the code
// the audit asked about. See the report accompanying this task for the actual
// before/after terminal output.
//
// The real race the route's own comment describes is CONCURRENT delivery: two ITNs
// whose non-transactional reads both land before either has committed. This check
// reproduces that deterministically (not by hoping two Promise.all calls interleave
// favourably) by holding the FIRST ITN's server-confirm fetch open until the SECOND has
// fully committed, using the fetch stub itself as the synchronisation point — no timers,
// no flakiness. Scenario 2 uses the same technique to flip a ticket to 'checked-in'
// mid-flight, strictly after the fast path's read and strictly before the transaction's
// re-read, so it discriminates the SAME inner guard rather than (only) the fast path.
//
// CREDENTIALS: needs PAYFAST_SANDBOX_PASSPHRASE (to sign a real ITN) and the
// FIREBASE_ADMIN_* triple (to write/read Firestore fixtures) from .env.local. Both are
// RUNTIME-only secrets absent from CI (see .github/workflows/ci.yml) — this check is
// LOCAL-ONLY. Missing credentials are reported as a distinct skip (see
// skipForMissingCredentials), never a silent or accidental pass.

import { Timestamp } from 'firebase-admin/firestore';

import {
  credentialsAvailable,
  skipForMissingCredentials,
  realPayfastIp,
  buildXff,
  buildItnRequest,
  loadItnPost,
  withFetchStub,
  itnFields,
  signAndEncode,
} from './_itn-harness.mts';

const ASSERTION_ID = 'A30/A31';

if (!credentialsAvailable()) skipForMissingCredentials(ASSERTION_ID);

const shared = await import('../ticketing-hardening/_shared.mjs');

await shared.withCleanup(
  `${ASSERTION_ID} the paid write is atomic and idempotent under a genuine concurrent race, and never resurrects a checked-in ticket`,
  async () => {
    const POST = await loadItnPost();
    const realIp = await realPayfastIp();
    const xff = buildXff(realIp);
    const id = shared.runId();

    // --- Scenario 1: two concurrent, otherwise-identical ITNs race for the same ticket
    const bookingRef1 = `PFM1-A3031-RACE-${id}`;
    const ticketRef1 = await shared.createTicketDoc({
      bookingRef: bookingRef1,
      m_payment_id: bookingRef1,
      attendeeEmail: shared.sentinelEmail(`a3031-race-${id}`),
      amount: 250,
    });

    const pfPaymentIdWinner = `pfm1-race-winner-${id}`;
    const pfPaymentIdLoser = `pfm1-race-loser-${id}`;
    const fieldsWinner = itnFields({
      mPaymentId: bookingRef1,
      amountGross: '250.00',
      pfPaymentId: pfPaymentIdWinner,
    });
    const fieldsLoser = itnFields({
      mPaymentId: bookingRef1,
      amountGross: '250.00',
      pfPaymentId: pfPaymentIdLoser,
    });
    const bodyWinner = await signAndEncode(fieldsWinner);
    const bodyLoser = await signAndEncode(fieldsLoser);
    const reqWinner = buildItnRequest({ body: bodyWinner, xff });
    const reqLoser = buildItnRequest({ body: bodyLoser, xff });

    let winnerCommittedResolve: () => void;
    const winnerCommitted = new Promise<void>((resolve) => {
      winnerCommittedResolve = resolve;
    });
    let purchasedAtAfterWinner: number | null = null;
    let pfPaymentIdAfterWinner: string | null = null;

    // The shared global-fetch stub distinguishes the two in-flight requests by the
    // pf_payment_id embedded in their posted body. The "loser" (whichever request we
    // deliberately hold back) does not resolve its server-confirm fetch until the
    // "winner" has FULLY finished — including its own transaction commit — which
    // deterministically forces the loser's transactional re-read to observe the
    // already-committed 'paid' state, exactly the race route.ts's comment describes.
    const racingStub = async (...args: unknown[]) => {
      const init = args[1] as { body?: string } | undefined;
      const isLoser = typeof init?.body === 'string' && init.body.includes(pfPaymentIdLoser);
      if (isLoser) await winnerCommitted;
      return { status: 200, text: async () => 'VALID' };
    };

    await withFetchStub(racingStub, async () => {
      const winnerDone = POST(reqWinner).then(async (res) => {
        const ticket = await shared.readTicketById(ticketRef1.id);
        purchasedAtAfterWinner = ticket?.purchasedAt?.toMillis?.() ?? null;
        pfPaymentIdAfterWinner = ticket?.pf_payment_id ?? null;
        winnerCommittedResolve();
        return res;
      });
      const loserDone = POST(reqLoser);
      await Promise.all([winnerDone, loserDone]);
    });

    shared.assert(
      purchasedAtAfterWinner != null,
      'PRECONDITION: the winning ITN never committed a purchasedAt stamp — race harness did not exercise the write path'
    );

    const afterRace = await shared.readTicketById(ticketRef1.id);
    shared.assert(afterRace?.status === 'paid', `after the race the ticket status is '${afterRace?.status}', not 'paid'`);
    shared.assert(
      afterRace?.pf_payment_id === pfPaymentIdAfterWinner,
      `the loser's transaction overwrote pf_payment_id after the winner had already committed: expected '${pfPaymentIdAfterWinner}' (the winner's), got '${afterRace?.pf_payment_id}'. A correctly guarded transaction re-reads status inside the transaction and no-ops once it is no longer 'reserved'.`
    );
    shared.assert(
      (afterRace?.purchasedAt?.toMillis?.() ?? null) === purchasedAtAfterWinner,
      `the loser's transaction re-stamped purchasedAt after the winner had already committed (${purchasedAtAfterWinner} -> ${afterRace?.purchasedAt?.toMillis?.()}) — the write is not idempotent under concurrency`
    );

    // --- Scenario 2: a ticket transitions to 'checked-in' WHILE a valid ITN is
    // mid-flight (strictly after the outer fast-path read saw 'reserved', strictly
    // before the transaction's re-read) — proves the transactional guard specifically,
    // not only the fast path a request arriving after check-in would hit anyway.
    const bookingRef2 = `PFM1-A3031-RESURRECT-${id}`;
    const ticketRef2 = await shared.createTicketDoc({
      bookingRef: bookingRef2,
      m_payment_id: bookingRef2,
      attendeeEmail: shared.sentinelEmail(`a3031-resurrect-${id}`),
      amount: 250,
    });

    const fields2 = itnFields({
      mPaymentId: bookingRef2,
      amountGross: '250.00',
      pfPaymentId: `pfm1-resurrect-attempt-${id}`,
    });
    const body2 = await signAndEncode(fields2);
    const req2 = buildItnRequest({ body: body2, xff });

    let checkedInAtStamp: FirebaseFirestore.Timestamp | null = null;
    const flipToCheckedInStub = async () => {
      checkedInAtStamp = Timestamp.now();
      await shared.db().collection('tickets').doc(ticketRef2.id).update({
        status: 'checked-in',
        checkedInAt: checkedInAtStamp,
      });
      return { status: 200, text: async () => 'VALID' };
    };

    await withFetchStub(flipToCheckedInStub, () => POST(req2));

    const afterResurrectAttempt = await shared.readTicketById(ticketRef2.id);
    shared.assert(
      afterResurrectAttempt?.status === 'checked-in',
      `a valid ITN that arrived while the ticket transitioned to 'checked-in' mid-flight changed its status to '${afterResurrectAttempt?.status}' — this resurrects an admitted ticket, letting the same booking reference open the door twice`
    );
    shared.assert(
      (afterResurrectAttempt?.checkedInAt?.toMillis?.() ?? null) === checkedInAtStamp?.toMillis(),
      'a valid ITN racing a check-in overwrote the checkedInAt audit timestamp'
    );
    shared.assert(
      afterResurrectAttempt?.pf_payment_id == null,
      `a valid ITN racing a check-in still wrote pf_payment_id ('${afterResurrectAttempt?.pf_payment_id}') onto a ticket that must stay untouched`
    );
  }
);
