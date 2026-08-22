// F3 (ozow-payment-provider) — verifies a REAL, live sandbox purchase actually happened and
// actually reached 'paid' under the RIGHT gateway, rather than trusting a BrowserAgent's own
// prose summary. Per this project's "the artifact a later check verifies against" design
// (.claude/rules/coding.md's automate-verification hierarchy), the BrowserAgent run writes a
// structured JSON artifact to a fixed path (see contracts/golden/ozow-m1-f3/README.md §1 for the
// exact schema and the required step names). This script:
//   1. Loads that artifact and validates its shape strictly — every REQUIRED_STEP name must be
//      present with pass === true, and allStepsPassed must itself be true. A partially-successful
//      run, or a run missing a required step, fails here before Firestore is even touched.
//   2. Reads the order back from LIVE Firestore by the artifact's own orderId (never trusts the
//      artifact's OWN claim about the order's final state) and asserts status === 'paid' and
//      gateway === the expected provider id, both by strict equality.
//
// Usage: node check-live-purchase.mjs <run-artifact.json> <expected-gateway: payfast|ozow>
//
// FAILS ON: artifact missing or malformed; any required step absent or pass !== true;
// allStepsPassed !== true; the order not found in Firestore; order.status !== 'paid';
// order.gateway !== the expected provider id (including the cross-contamination case where an
// Ozow run's order shows gateway:'payfast' or vice versa).

import { readFileSync } from 'node:fs';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const REQUIRED_STEPS = [
  'load-checkout-page',
  'select-provider',
  'submit-checkout-initiate',
  'redirect-to-gateway-sandbox',
  'complete-sandbox-payment',
  'gateway-notification-received',
  'order-reaches-paid',
  'confirmation-page-shows-paid',
];

const KNOWN_GATEWAYS = new Set(['payfast', 'ozow']);

function fail(msg) {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
}

const [, , artifactPath, expectedGateway] = process.argv;

if (!artifactPath || !expectedGateway) {
  fail('usage: check-live-purchase.mjs <run-artifact.json> <expected-gateway: payfast|ozow>');
}
if (!KNOWN_GATEWAYS.has(expectedGateway)) {
  fail(`expected-gateway must be 'payfast' or 'ozow', got '${expectedGateway}'`);
}

let raw;
try {
  raw = readFileSync(artifactPath, 'utf8');
} catch (err) {
  fail(`could not read artifact at ${artifactPath}: ${err.message}`);
}

let run;
try {
  run = JSON.parse(raw);
} catch (err) {
  fail(`artifact at ${artifactPath} is not valid JSON: ${err.message}`);
}

if (run.provider !== expectedGateway) {
  fail(`artifact.provider is '${run.provider}', expected '${expectedGateway}'`);
}
if (typeof run.orderId !== 'string' || run.orderId.length === 0) {
  fail('artifact.orderId is missing or empty — no order to read back');
}
if (!Array.isArray(run.steps)) {
  fail('artifact.steps is not an array');
}
if (run.allStepsPassed !== true) {
  fail(`artifact.allStepsPassed is ${run.allStepsPassed}, expected true`);
}

const stepsByName = new Map(run.steps.map((s) => [s.name, s]));
const missingSteps = REQUIRED_STEPS.filter((name) => !stepsByName.has(name));
if (missingSteps.length > 0) {
  fail(`artifact.steps is missing required step(s): ${missingSteps.join(', ')}`);
}
const failedSteps = REQUIRED_STEPS.filter((name) => stepsByName.get(name).pass !== true);
if (failedSteps.length > 0) {
  fail(`required step(s) did not pass: ${failedSteps.join(', ')}`);
}

if (getApps().length === 0) {
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (!projectId || !clientEmail || !privateKey) {
    fail('missing FIREBASE_ADMIN_* credentials — cannot read back the live order');
  }
  initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
}

const db = getFirestore();
const orderSnap = await db.collection('orders').doc(run.orderId).get();
if (!orderSnap.exists) {
  fail(`orders/${run.orderId} does not exist in Firestore — the artifact's orderId is stale or wrong`);
}
const order = orderSnap.data();

if (order.status !== 'paid') {
  fail(`orders/${run.orderId}.status is '${order.status}', expected 'paid'`);
}
if (order.gateway !== expectedGateway) {
  fail(`orders/${run.orderId}.gateway is '${order.gateway}', expected '${expectedGateway}'`);
}

console.log(
  `PASS: orders/${run.orderId} reached status='paid' under gateway='${expectedGateway}' — ` +
    `${REQUIRED_STEPS.length}/${REQUIRED_STEPS.length} required BrowserAgent steps passed.`
);
process.exit(0);
