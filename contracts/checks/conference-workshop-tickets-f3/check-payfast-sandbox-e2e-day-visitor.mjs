// F3 (conference-workshop-tickets, M2) — real PayFast SANDBOX checkout-to-ITN-to-
// ticket-issued flow for a 'day-visitor' purchase, proving the pre-existing payment/email
// path still works end to end after this feature's new excludedDays rejection branch was
// added to app/api/tickets/checkout/route.ts (A21) — a regression a careless early-return
// in that new branch could plausibly introduce for the ACCEPTED path too, not just the
// rejected one. REUSES the existing payfast-m1 ITN harness
// (contracts/checks/payfast-m1/_itn-harness.mts) end to end — no new payment code — same
// convention as F4's check-payfast-sandbox-e2e-early-bird.mjs. This is also the real,
// sourced purchase A30's gws_inbox_check relay checks the confirmation email for; without a
// real completed sandbox order, there would be nothing real for that assertion to verify.
//
// CREDENTIALS: needs PAYFAST_SANDBOX_PASSPHRASE + the FIREBASE_ADMIN_* triple from
// .env.local, same as every other payfast-m1 behavioural check — LOCAL-ONLY, reported
// as a distinct skip (never a silent/accidental pass) when absent.
import { register } from 'tsx/esm/api';

register();

const harness = await import('../payfast-m1/_itn-harness.mts');
const {
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
} = harness;

const ASSERTION_ID = 'A29 (conference-workshop-tickets F3)';

if (!credentialsAvailable()) skipForMissingCredentials(ASSERTION_ID);

const { ADMISSION_PRODUCTS } = await import('../../../lib/provisional-figures.ts');
const dayVisitor = ADMISSION_PRODUCTS.find((p) => p.slug === 'day-visitor');
if (!dayVisitor) {
  console.error('FAIL: check-payfast-sandbox-e2e-day-visitor.mjs');
  console.error("  - no 'day-visitor' product in ADMISSION_PRODUCTS — cannot exercise its real price");
  process.exit(1);
}

const shared = await import('../ticketing-hardening/_shared.mjs');

await shared.withCleanup(`${ASSERTION_ID} a full checkout-to-ITN-to-paid flow for day-visitor, post-excludedDays-check`, async () => {
  const id = shared.runId();
  const bookingRef = `CWT-F3-A29-${id}`;
  const attendeeEmail = shared.sentinelEmail(`cwt-f3-a29-${id}`);

  const positionRef = await createOrderAndPosition({
    bookingRef,
    attendeeEmail,
    amount: dayVisitor.price,
    ticketType: 'day-visitor',
  });

  const POST = await loadItnPost();
  const realIp = await realPayfastIp();
  const xff = buildXff(realIp);

  const fields = itnFields({ mPaymentId: bookingRef, amountGross: dayVisitor.price.toFixed(2) });
  const body = await signAndEncode(fields);

  const { result: response } = await withFetchStub(confirmStub('VALID'), () =>
    POST(buildItnRequest({ body, xff })),
  );

  const failures = [];
  if (response.status !== 200) {
    failures.push(`ITN POST returned status ${response.status}, expected 200`);
  }

  const snapshot = await positionRef.get();
  const data = snapshot.data();
  if (!data || data.status !== 'paid') {
    failures.push(`position status is ${JSON.stringify(data?.status)}, expected 'paid' after a successful ITN`);
  }

  if (failures.length > 0) {
    throw new Error(failures.join('; '));
  }
});
