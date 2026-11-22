#!/usr/bin/env node
// Real POST /api/vendors/stand-payment/initiate (in-memory fixtures only). Proves:
// (SEC-06) the stand order carries `issuedInTestMode`, a boolean own property, true when the Ozow
// sandbox test mode is on and false when off, on a first initiate AND on a re-initiate after the
// mode flips (the stamp follows the CURRENT attempt); settlement keeps the field.
// (SEC-22 part) the 11th initiate from one client key inside the window is a 429 with the
// checkout wording, and a limited request reads no Firestore document.
//
// Run as:
//   NODE_OPTIONS="--require $PWD/contracts/harness/route-runner/preload.cjs" \
//     npx tsx contracts/checks/vendor-stand-sandbox-amount/check-issued-in-test-mode-and-limiter.mjs

import { initiate, notify, resetAll, seedSubmission, setTestMode, store } from './_harness.mjs';

const failures = [];
const expect = (cond, msg) => { if (!cond) failures.push(msg); };
const ID = 'aB3dEfGh1234567890ZZ';
const MAX_ATTEMPTS = 10;
const hasStamp = (order) => order !== undefined
  && Object.prototype.hasOwnProperty.call(order, 'issuedInTestMode')
  && typeof order.issuedInTestMode === 'boolean';

// Distinct client key per scenario so the shared in-memory limiter never interferes.
let clientCounter = 0;
const freshClient = () => ({ 'x-forwarded-for': `198.51.100.${++clientCounter}` });

// Launch constants (ticketing test mode, adapter sandbox flags) can keep the stamp true even with
// the toggle off, so the expectation is the shared ticket derivation, not a hard-coded false.
const { isIssuanceTestMode } = await import('../../../lib/ticket-issuance-mode.ts');
const expectedWhen = (flag) => isIssuanceTestMode({ ozowSandboxTestMode: flag });
expect(expectedWhen(true) === true, 'toggle on must always stamp true.');

for (const flag of [true, false]) {
  resetAll(); setTestMode(flag); seedSubmission(ID);
  const r = await initiate(ID, 'ozow', freshClient());
  expect(r.status === 200, `first initiate (mode ${flag}): returned ${r.status}.`);
  expect(hasStamp(r.order), `first initiate (mode ${flag}): order needs a boolean issuedInTestMode own property.`);
  expect(r.order?.issuedInTestMode === expectedWhen(flag), `first initiate (mode ${flag}): stamp must be ${expectedWhen(flag)}, got ${r.order?.issuedInTestMode}.`);
}

// Re-initiate after the mode flips, both directions: the stamp follows the live attempt.
for (const [from, to] of [[true, false], [false, true]]) {
  resetAll(); setTestMode(from); seedSubmission(ID);
  const client = freshClient();
  const a = await initiate(ID, 'ozow', client);
  setTestMode(to);
  const b = await initiate(ID, 'ozow', client);
  expect(b.status === 200 && b.order.attemptId !== a.order.attemptId, `re-initiate ${from}->${to}: must mint a new attempt.`);
  expect(hasStamp(b.order) && b.order.issuedInTestMode === expectedWhen(to), `re-initiate ${from}->${to}: stamp must follow the current attempt (${expectedWhen(to)}), got ${b.order?.issuedInTestMode}.`);
}

// Settlement keeps the stamp (record-only: no refusal added, field not dropped).
resetAll(); setTestMode(true); seedSubmission(ID);
const live = await initiate(ID, 'ozow', freshClient());
const cents = Math.round(live.order.amount * 100);
const code = await notify('ozow', { reference: live.call.reference, rawStatus: 'paid', grossAmountCents: 1, gatewayPaymentId: 'gw-stamp-1' });
expect(code === 200, `settlement: acknowledged 200, got ${code}.`);
expect(store.vendorStandOrders.get(ID)?.status === 'paid', `settlement: test-mode order must settle on the one-cent notification (real price ${cents}c).`);
expect(store.vendorStandOrders.get(ID)?.issuedInTestMode === true, 'settlement: issuedInTestMode must survive settlement.');

// Limiter: 10 allowed, the 11th is 429, and a limited request reads nothing.
resetAll(); setTestMode(false); seedSubmission(ID);
const limited = freshClient();
for (let i = 0; i < MAX_ATTEMPTS; i++) {
  const r = await initiate(ID, 'ozow', limited);
  expect(r.status !== 429, `attempt ${i + 1} within the limit must not be 429.`);
}
let reads = 0;
// The route reads vendorSubmissions first, so a request refused before that reads nothing (the
// harness's own post-call order read is on vendorStandOrders and is deliberately not counted).
for (const name of ['vendorSubmissions', 'adminSettings']) {
  const map = store.getCollectionMap(name);
  const original = map.get.bind(map);
  map.get = (key) => { reads += 1; return original(key); };
}
const over = await initiate(ID, 'ozow', limited);
expect(over.status === 429, `attempt ${MAX_ATTEMPTS + 1} must be 429, got ${over.status}.`);
expect(over.body?.error === 'Too many attempts. Please try again later.', `429 body must reuse the checkout wording, got ${JSON.stringify(over.body)}.`);
expect(reads === 0, `a limited request must do no Firestore read, saw ${reads}.`);
const other = await initiate(ID, 'ozow', freshClient());
expect(other.status !== 429, 'a different client key must not be limited.');

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  process.exit(1);
}
console.log('PASS: stand order stamps issuedInTestMode (first and re-initiate, kept by settlement); initiate is rate-limited with no Firestore read when limited.');
