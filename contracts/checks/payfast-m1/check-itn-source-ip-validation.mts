// A18 — behavioural proof that source-IP validation genuinely gates the write path,
// using a REAL DNS lookup of one of PayFast's published ITN hosts (no mocking of
// resolvePayfastIps() itself — see _itn-harness.mts's header comment).
//
// HONEST SCOPE NOTE (asked for explicitly in the task brief): this proves genuine
// branching IP validation exists and is correctly wired — a bogus IP is rejected before
// any write, and the SAME real-DNS-resolved IP that a legitimate PayFast ITN would
// arrive from is accepted. It does NOT prove the implementation re-resolves via DNS on
// every single request as opposed to some snapshot/caching strategy — resolvePayfastIps()
// itself is exercised unmodified either way, so that distinction is invisible from
// outside the route regardless of test strategy. That residual gap is narrow and
// acceptable: a hardcoded IP list would still require someone to have hardcoded PayFast's
// ACTUAL current IPs for this check's positive case to pass at all (a staleness risk when
// PayFast rotates, not a validation-bypass — the old detection gap was a route that could
// hardcode ANY IP list, including one the tester controls, alongside a `// TODO: dns
// lookup` comment that never runs; this check cannot be satisfied that way, since the
// real-IP case depends on the route resolving a real host at request time).
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
  BOGUS_SOURCE_IP,
} from './_itn-harness.mts';

const ASSERTION_ID = 'A18';

if (!credentialsAvailable()) skipForMissingCredentials(ASSERTION_ID);

const shared = await import('../ticketing-hardening/_shared.mjs');

await shared.withCleanup(
  `${ASSERTION_ID} source-IP validation genuinely gates the ITN write path`,
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

    // A bogus, guaranteed-never-PayFast IP (TEST-NET-3, RFC 5737) at the trusted XFF
    // hop, everything else valid -> the ticket must stay untouched. We cannot directly
    // observe "the Firestore read for m_payment_id was never reached", but an untouched
    // reserved ticket is the same guarantee from the outside: no path from a rejected-IP
    // request reaches the write.
    {
      const { bookingRef, ref } = await freshTicket('BOGUS');
      await deliver(bookingRef, buildXff(BOGUS_SOURCE_IP));
      const after = await shared.readTicketById(ref.id);
      shared.assert(
        after?.status === 'reserved',
        `a bogus, non-PayFast source IP (${BOGUS_SOURCE_IP}) still resulted in status '${after?.status}' — the write path was reached despite failing IP validation`
      );
    }

    // The genuinely DNS-resolved IP of a real PayFast ITN host -> accepted, and the
    // ticket becomes paid. This doubles as A18's positive proof: source-IP validation is
    // not merely present, it actually admits the traffic it is supposed to.
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
