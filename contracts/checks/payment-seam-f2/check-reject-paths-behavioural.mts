// A11 — THE DARK SIDE OF THE GATEWAY PATH: behavioural proof that the notification route
// REFUSES.
//
// WHY THIS EXISTS. F2 moved signature verification wholesale into the adapter, and until this
// check every scrap of behavioural evidence about it came from A6's suite, whose harness
// (_itn-harness.mts signAndEncode) ALWAYS signs correctly with the real passphrase. Every
// rejection path was therefore untested end to end: the accept path was proven, the refuse path
// was dark. A rewire that only ever demonstrates acceptance has demonstrated half a payment
// gateway, and it is the half that does not lose money.
//
// WHAT IT ASSERTS — BEHAVIOUR, NOT SHAPE. Nothing here greps for a guard, a status code, or a
// reason string in source. Each case drives the REAL exported POST() of the REAL route with a
// real urlencoded body and observes what the handler actually did:
//   - the HTTP response it returned,
//   - which diagnostic it emitted, and specifically WHICH reason code,
//   - whether it made any outbound network call,
//   - whether it reached the order lookup at all.
//
// THE ORDER-LOOKUP MARKER IS THE LOAD-BEARING INSTRUMENT. FIREBASE_ADMIN_* is deliberately
// unset for the duration of this check, so initAdmin() throws the moment anything tries to
// build a Firestore client. The route catches that and logs `[tickets/itn] Order lookup failed`
// — a line reachable from exactly ONE place in the route, the catch around
// findReservedOrderByPaymentId, and only after verification has already returned verified.
// That single marker therefore serves twice, and in opposite directions:
//   - its ABSENCE in cases 1-3 is positive proof the handler refused BEFORE touching any order;
//   - its PRESENCE in case 4 is positive proof the handler ACCEPTED a good body.
// This is deliberate. Two defects already found on this contract were an assertion satisfied by
// a NEIGHBOURING guard's status code, and an assertion satisfied by the wrong question being
// asked. Evidence here is bound to one uniquely-reachable construct, and every reason code is
// pinned to its exact value rather than merely required to exist.
//
// CASE 4 IS NOT OPTIONAL AND MUST NEVER BE DROPPED. Without it, an adapter whose
// verifyNotification returned `{ verified: false }` unconditionally — refusing every real
// customer payment — would pass cases 1-3 with three confident greens. That is precisely how
// payfast-m1's A18 spent five runs green for a reason unrelated to its stated property. Case 4
// is what makes cases 1-3 mean anything.
//
// CREDENTIALS: NONE. No Firestore, no network, no .env.local. The shared secret is set to a
// value chosen in this process (the adapter reads env PER CALL by design, which is the property
// that makes this possible), so the check is deterministic and CI-safe.
//
// SCOPE NOTE, stated so nobody over-claims it: case 3 and case 4 sign with the same
// generateNotifySignature the adapter verifies with, so this check does NOT independently prove
// that algorithm correct — contract-payfast-itn-signature A5/A6 do that. Case 1 does not depend
// on the algorithm at all: it corrupts the signature string directly, so no shared implementation
// can make a wrong signature look right.
//
// Run as: npx tsx contracts/checks/payment-seam-f2/check-reject-paths-behavioural.mts

import { getApps } from 'firebase-admin/app';

import { generateNotifySignature } from '@/lib/payfast';

const TEST_PASSPHRASE = 'a11-reject-path-passphrase-not-a-real-secret';
const ROUTE_LOG_PREFIX = '[tickets/itn]';
/** Reachable from exactly one place in the route, and only past a verified notification. */
const ORDER_LOOKUP_MARKER = `${ROUTE_LOG_PREFIX} Order lookup failed`;
const REJECTED_MARKER = `${ROUTE_LOG_PREFIX} Notification rejected before any order was touched`;

let failures = 0;
function check(condition: boolean, message: string): void {
  if (condition) return;
  failures += 1;
  console.error(`FAIL A11: ${message}`);
}

/** Everything the route did during one delivery, as observed from outside. */
interface Observation {
  status: number;
  body: unknown;
  logs: Array<{ message: string; context: unknown }>;
  fetchCalls: number;
  threw: string | null;
}

function bodyOf(fields: Record<string, string>, signature: string | null): string {
  const params = new URLSearchParams(fields);
  if (signature !== null) params.set('signature', signature);
  return params.toString();
}

function goodFields(reference: string): Record<string, string> {
  // Insertion order is the signature base-string order — the adapter parses posted order.
  return {
    m_payment_id: reference,
    pf_payment_id: `a11-${reference}`,
    payment_status: 'COMPLETE',
    item_name: 'SAOC 2027 National Show Ticket',
    amount_gross: '250.00',
  };
}

async function deliver(rawBody: string): Promise<Observation> {
  const logs: Observation['logs'] = [];
  let fetchCalls = 0;

  const realError = console.error;
  const realWarn = console.warn;
  const realFetch = globalThis.fetch;

  console.error = (message?: unknown, context?: unknown) => {
    logs.push({ message: String(message), context });
  };
  console.warn = (message?: unknown, context?: unknown) => {
    logs.push({ message: String(message), context });
  };
  // Any outbound call on a rejected notification is itself a defect: the out-of-band server
  // confirmation must never fire for a body the handler has not authenticated.
  globalThis.fetch = (async () => {
    fetchCalls += 1;
    throw new Error('A11 tripwire: the route made an outbound network call');
  }) as typeof fetch;

  try {
    // A11_ROUTE_IMPORT_OVERRIDE is NOT part of normal operation — the contract runs this check
    // with it unset, which always imports the real, pinned route. It exists solely so
    // check-reject-paths-mutations.sh can drive generated mutants without ever editing a
    // production file. Same convention, and same reason, as _itn-harness.mts's
    // ITN_ROUTE_IMPORT_OVERRIDE.
    const override = process.env.A11_ROUTE_IMPORT_OVERRIDE;
    const { POST } = override
      ? await import(/* @vite-ignore */ override)
      : await import('@/app/api/tickets/itn/route');
    const request = {
      text: async () => rawBody,
      headers: { get: () => null },
    } as unknown as import('next/server').NextRequest;
    try {
      const response = await POST(request);
      return { status: response.status, body: await response.json(), logs, fetchCalls, threw: null };
    } catch (error) {
      return { status: -1, body: null, logs, fetchCalls, threw: String(error) };
    }
  } finally {
    console.error = realError;
    console.warn = realWarn;
    globalThis.fetch = realFetch;
  }
}

function reasonOf(observation: Observation): unknown {
  const line = observation.logs.find((entry) => entry.message.includes(REJECTED_MARKER));
  return (line?.context as { reason?: unknown } | undefined)?.reason;
}

function reachedOrderLookup(observation: Observation): boolean {
  return observation.logs.some((entry) => entry.message.includes(ORDER_LOOKUP_MARKER));
}

/** The four assertions every refusal owes, regardless of why it refused. */
function assertRefusedCleanly(label: string, observation: Observation, expectedReason: string): void {
  check(observation.threw === null, `${label}: the route threw instead of refusing — ${observation.threw}`);
  check(
    observation.status === 200,
    `${label}: responded ${observation.status}, not 200. The gateway must be told to stop retrying; a non-200 makes it redeliver a body we have already refused.`
  );
  check(
    reasonOf(observation) === expectedReason,
    `${label}: refused with reason '${String(reasonOf(observation))}', expected exactly '${expectedReason}'. A refusal that reports the wrong cause is a refusal an operator cannot act on — an unset secret blamed on the gateway sends someone to debug PayFast for a fault in our own configuration.`
  );
  check(
    !reachedOrderLookup(observation),
    `${label}: reached the order lookup. An unverified notification must be refused BEFORE any order is read or written; the '${ORDER_LOOKUP_MARKER}' marker is only reachable past a verified body.`
  );
  check(
    observation.fetchCalls === 0,
    `${label}: made ${observation.fetchCalls} outbound network call(s) on an unverified notification.`
  );
}

async function main(): Promise<number> {
  // The Firestore tripwire. Deleting these makes initAdmin() throw the instant anything tries
  // to reach an order, which is what turns "did it touch the order?" into an observable fact.
  delete process.env.FIREBASE_ADMIN_PROJECT_ID;
  delete process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  delete process.env.FIREBASE_ADMIN_PRIVATE_KEY;
  check(
    getApps().length === 0,
    'PRECONDITION: a Firebase app was already initialised before the first delivery — the order-lookup marker cannot be trusted in this process.'
  );

  // ---- Case 1: a BAD signature. Independent of the signing algorithm: the signature is a
  // real-shaped 32-hex digest that simply is not the right one.
  {
    process.env.PAYFAST_SANDBOX_PASSPHRASE = TEST_PASSPHRASE;
    const fields = goodFields('A11-BAD-SIG');
    const wrong = 'deadbeef'.repeat(4);
    check(
      generateNotifySignature(fields, TEST_PASSPHRASE) !== wrong,
      'PRECONDITION: the deliberately-wrong signature happens to be the correct one — case 1 would be testing the accept path.'
    );
    assertRefusedCleanly('case 1 (bad signature)', await deliver(bodyOf(fields, wrong)), 'signature-mismatch');
  }

  // ---- Case 2: NO signature field at all. Distinct from a wrong one: a handler that treats
  // absent as "nothing to compare, therefore fine" is the classic fail-open.
  {
    process.env.PAYFAST_SANDBOX_PASSPHRASE = TEST_PASSPHRASE;
    const fields = goodFields('A11-NO-SIG');
    assertRefusedCleanly('case 2 (absent signature)', await deliver(bodyOf(fields, null)), 'missing-signature');
  }

  // ---- Case 3: the shared secret is UNSET, body otherwise perfectly signed. The reason code is
  // pinned hard: without a secret the digest degrades to an MD5 over publicly-known fields, so
  // this must be refused as a CONFIGURATION fault and must never be reported as, or reached via,
  // a signature comparison.
  {
    const fields = goodFields('A11-NO-SECRET');
    const signature = generateNotifySignature(fields, TEST_PASSPHRASE);
    delete process.env.PAYFAST_SANDBOX_PASSPHRASE;
    assertRefusedCleanly('case 3 (unset secret)', await deliver(bodyOf(fields, signature)), 'not-configured');
  }

  // ---- Case 4: THE POSITIVE CONTROL. A correctly-signed body with the secret set must be
  // ACCEPTED by verification and must proceed to the order lookup. Without this, an adapter that
  // refused everything would pass cases 1-3.
  {
    process.env.PAYFAST_SANDBOX_PASSPHRASE = TEST_PASSPHRASE;
    const fields = goodFields('A11-CONTROL');
    const signature = generateNotifySignature(fields, TEST_PASSPHRASE);
    const observation = await deliver(bodyOf(fields, signature));
    check(
      reasonOf(observation) === undefined,
      `case 4 (positive control): a correctly-signed notification was REFUSED with reason '${String(reasonOf(observation))}'. Cases 1-3 prove nothing while this is red — a handler that refuses everything satisfies all three.`
    );
    check(
      reachedOrderLookup(observation),
      'case 4 (positive control): a correctly-signed notification never reached the order lookup, so verification did not accept it. Cases 1-3 are meaningless without this.'
    );
    check(observation.status === 200, `case 4 (positive control): responded ${observation.status}, not 200.`);
  }

  if (failures > 0) {
    console.error(`\nFAIL A11: ${failures} reject-path assertion(s) failed.`);
    return 1;
  }
  console.error(
    'PASS A11: the notification route refuses a bad signature, an absent signature and an unset\n' +
      '         shared secret — each with its own correct reason, each before any order is read,\n' +
      '         each without an outbound call — and still accepts a correctly-signed body.'
  );
  return 0;
}

process.exit(await main());
