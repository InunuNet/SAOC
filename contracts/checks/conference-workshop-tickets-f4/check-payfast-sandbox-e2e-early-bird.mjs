// F4 (conference-workshop-tickets, M2) — A14: a full PayFast SANDBOX checkout-to-ITN-
// to-ticket-issued flow succeeds for the early-bird (day-visitor EB) product, at its
// post-F2 price. REUSES the existing payfast-m1 ITN harness
// (contracts/checks/payfast-m1/_itn-harness.mts) end to end — no new payment code, no
// new harness — per the golden §6 ("reusing both paths exactly as they exist today, no
// new payment or email code"). See that harness's own header comment for why this
// reaches the real write path in process (direct POST() import, real DNS-resolved
// source IP, stubbed server-confirm fetch) without needing a running dev server or a
// real PayFast-originated request, and A15's sibling grep assertion for why lib/payfast.ts
// itself must stay byte-unchanged.
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

const ASSERTION_ID = 'A14 (conference-workshop-tickets F4)';

if (!credentialsAvailable()) skipForMissingCredentials(ASSERTION_ID);

const { ADMISSION_PRODUCTS } = await import('../../../lib/provisional-figures.ts');
const earlyBird = ADMISSION_PRODUCTS.find((p) => p.slug === 'early-bird');
if (!earlyBird) {
  console.error('FAIL: check-payfast-sandbox-e2e-early-bird.mjs');
  console.error("  - no 'early-bird' product in ADMISSION_PRODUCTS — cannot exercise its real price");
  process.exit(1);
}

const shared = await import('../ticketing-hardening/_shared.mjs');

await shared.withCleanup(`${ASSERTION_ID} a full checkout-to-ITN-to-paid flow for early-bird`, async () => {
  const id = shared.runId();
  const bookingRef = `CWT-F4-A14-${id}`;
  const attendeeEmail = shared.sentinelEmail(`cwt-f4-a14-${id}`);

  // Checkout-equivalent step: create the order+position pair exactly as route.ts's
  // reservation transaction would, at early-bird's real, post-F2 price — not a
  // second, hand-typed amount that could silently drift from the live figure.
  const positionRef = await createOrderAndPosition({
    bookingRef,
    attendeeEmail,
    amount: earlyBird.price,
    ticketType: 'early-bird',
  });

  const POST = await loadItnPost();
  const realIp = await realPayfastIp();
  const xff = buildXff(realIp);

  const fields = itnFields({ mPaymentId: bookingRef, amountGross: earlyBird.price.toFixed(2) });
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
// withCleanup() itself prints the PASS/FAIL line and sets process.exitCode — nothing
// after this point, or a successful withCleanup (exitCode left at 0) would still print
// a spurious PASS even when the body above threw (exitCode 1) if this script added its
// own unconditional trailing message.
