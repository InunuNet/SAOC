// A18 — behavioural proof of the CURRENT, intentional source-IP policy: source IP is
// advisory only and can never reject an otherwise-authenticated notification.
//
// CORRECTION OF A FALSE CLAIM (2026-08-20, @architect, dispatched off a read-only sweep
// finding): this assertion previously claimed the inverse of shipped behaviour — that a
// bogus source IP left the ticket untouched (rejected). That was true of the pre-2026-08-18
// route. It has not been true since app/api/tickets/itn/route.ts:69-86 and
// lib/payments/payfast.ts's verifyNotification() were deliberately changed: a real,
// correctly-signed sandbox notification was observed arriving from a Google Cloud address
// outside the gateway's published host set, so enforcing source-IP rejection was rejecting
// genuine, already-authenticated payments. `sourceIpTrusted` is computed by the adapter and
// consumed ONLY by `console.warn` in route.ts — it gates no control flow anywhere in the
// route, the adapter, or any helper (verified independently before this rewrite: grep for
// `sourceIpTrusted` across app/ and lib/ shows exactly those two call sites, both logging).
// The prior version of this file was passing 5/5 for an unrelated reason
// (order-not-found on both fixtures) and would have stayed green if IP rejection had been
// reintroduced by mistake — it asserted the opposite of the property it needed to guard.
//
// WHAT THIS NOW PROVES: a notification with an untrustworthy or undeterminable source IP,
// but a valid signature and a successful server-confirm round trip, STILL reaches 'paid'.
// This is the real security-boundary claim from the 2026-08-18 decision: body
// authentication (verifyNotification's signature check) plus the server-confirm round trip
// (the gateway's own documented anti-spoofing mechanism) are what gate the write; source IP
// is defense-in-depth only. This is also the regression this check exists to catch: if
// someone "hardens" IP checking back into a payment-rejecting path — exactly the mistake
// the 2026-08-18 incident already made once — a genuinely-authenticated payment from a
// legitimate but unlisted PayFast host would start silently failing to settle, and this
// check must turn red.
//
// Both a bogus (TEST-NET-3, RFC 5737) source IP and a genuinely DNS-resolved PayFast host
// IP are exercised, and BOTH must result in 'paid' — proving the outcome does not depend on
// which IP arrived, only on signature + server-confirm succeeding. This uses the same real
// dns.lookup() fixture as before (no mocking resolvePayfastIps() itself — see
// _itn-harness.mts's header comment) so a future re-introduction of IP gating cannot pass by
// coincidence.
//
// CREDENTIALS: LOCAL-ONLY — see check-itn-atomic-idempotent-write.mts's header comment.
// Same silent-skip convention as A19-A21 (skipForMissingCredentials exits 0 with a
// ::warning:: annotation when PAYFAST_SANDBOX_*/FIREBASE_ADMIN_* are absent). That
// exit-0-on-skip shape is shared project-wide across this whole suite and is a real
// instrument-vs-absence hazard (a summary that only reads exit codes cannot tell "skipped"
// from "passed") — NOT fixed here. Fixing it means changing the shared skip convention in
// _itn-harness.mts, which every check in this directory depends on identically; that is a
// suite-wide contract/gate decision, not something to change unilaterally as a side effect
// of correcting one assertion's claim. Flagging it as a follow-up, not silently leaving it
// unaddressed: whoever owns the contract gate should decide whether LOCAL-ONLY checks need a
// distinct exit code (e.g. exit 3 for "skipped") so CI/local summaries can tell skip and
// pass apart without reading stderr.

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
  BOGUS_SOURCE_IP,
} from './_itn-harness.mts';

const ASSERTION_ID = 'A18';

if (!credentialsAvailable()) skipForMissingCredentials(ASSERTION_ID);

const shared = await import('../ticketing-hardening/_shared.mjs');

await shared.withCleanup(
  `${ASSERTION_ID} source IP is advisory only — never gates the ITN write path`,
  async () => {
    const POST = await loadItnPost();
    const id = shared.runId();

    async function freshTicket(label) {
      const bookingRef = `PFM1-A18-${label}-${id}`;
      const ref = await createOrderAndPosition({
        bookingRef,
        attendeeEmail: shared.sentinelEmail(`a18-${label.toLowerCase()}-${id}`),
        amount: 250,
      });
      return { bookingRef, ref };
    }

    async function deliver(bookingRef, xff) {
      const fields = itnFields({ mPaymentId: bookingRef, amountGross: '250.00' });
      const body = await signAndEncode(fields);
      const request = buildItnRequest({ body, xff });
      return withFetchStub(confirmStub('VALID'), () => POST(request));
    }

    // A bogus, guaranteed-never-PayFast IP (TEST-NET-3, RFC 5737) at the trusted XFF hop,
    // everything else valid (real signature, successful server-confirm) -> the ticket must
    // STILL become paid. This is the property the 2026-08-18 decision depends on: an
    // untrusted or unresolvable source IP must never be able to reject an otherwise
    // authenticated payment.
    {
      const { bookingRef, ref } = await freshTicket('BOGUS');
      await deliver(bookingRef, buildXff(BOGUS_SOURCE_IP));
      const after = await shared.readTicketById(ref.id);
      shared.assert(
        after?.status === 'paid',
        `a bogus, non-PayFast source IP (${BOGUS_SOURCE_IP}) left the ticket as '${after?.status}' instead of 'paid' — source IP is gating the write path again, contradicting the documented 2026-08-18 decision`
      );
    }

    // The genuinely DNS-resolved IP of a real PayFast ITN host -> also accepted, and the
    // ticket becomes paid. Kept alongside the bogus case to show the outcome is identical
    // regardless of which IP arrived — the write path does not branch on source IP at all.
    {
      const realIp = await realPayfastIp();
      const { bookingRef, ref } = await freshTicket('REAL');
      await deliver(bookingRef, buildXff(realIp));
      const after = await shared.readTicketById(ref.id);
      shared.assert(
        after?.status === 'paid',
        `a genuinely DNS-resolved PayFast source IP (${realIp}) was rejected — status is '${after?.status}'`
      );
    }
  }
);
