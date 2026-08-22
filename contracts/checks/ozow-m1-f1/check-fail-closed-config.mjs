#!/usr/bin/env node
// A4 — FAIL-CLOSED CREDENTIAL GUARDS + PER-CALL ENV READ. Mirrors payment-seam-f1 A4's discipline
// for the new gateway: missing SITE_CODE/PRIVATE_KEY must refuse by RETURN VALUE, never by
// throwing, and the refusal must carry no fields and no processUrl. Env is read PER CALL, not
// captured at construction — Firebase App Hosting supplies these variables at RUNTIME only.
//
// WHAT MAKES THIS FAIL: the module not existing; a throw instead of a refusal; a refusal carrying
// fields; empty strings treated as present; config snapshotted at construction (would refuse every
// real purchase in production while passing every offline test).
//
// Run as: npx tsx contracts/checks/ozow-m1-f1/check-fail-closed-config.mjs

import { createOzowProvider } from '../../../lib/payments/ozow.ts';
import { golden, makeReporter } from './_golden.mjs';

const r = makeReporter('A4 fail-closed credential guards');
const g = golden.outbound;
const creds = golden.credentials;

async function initiateWith(env, caseName) {
  try {
    return await createOzowProvider({ env }).initiate(g.inputs);
  } catch (error) {
    r.ok(`${caseName}: refuses by return value, never by throwing`, false, String(error));
    return { ok: false, reason: 'threw' };
  }
}

// Case 1 — POSITIVE CONTROL.
const good = await initiateWith(
  { OZOW_SANDBOX_SITE_CODE: creds.siteCode, OZOW_SANDBOX_PRIVATE_KEY: creds.privateKey },
  'case 1'
);
r.ok('case 1: full credentials succeed', good.ok === true, JSON.stringify(good));

const refusals = [
  ['case 2: site code missing', { OZOW_SANDBOX_PRIVATE_KEY: creds.privateKey }],
  ['case 3: private key missing', { OZOW_SANDBOX_SITE_CODE: creds.siteCode }],
  ['case 4a: both missing', {}],
  ['case 4b: site code empty string', { OZOW_SANDBOX_SITE_CODE: '', OZOW_SANDBOX_PRIVATE_KEY: creds.privateKey }],
  ['case 4c: private key empty string', { OZOW_SANDBOX_SITE_CODE: creds.siteCode, OZOW_SANDBOX_PRIVATE_KEY: '' }],
];
for (const [name, env] of refusals) {
  const result = await initiateWith(env, name);
  r.ok(`${name}: refused`, result.ok === false, JSON.stringify(result));
  if (result.ok === false) {
    r.eq(`${name}: reason`, result.reason, 'not-configured');
    r.ok(`${name}: refusal carries no fields`, !('fields' in result), JSON.stringify(result));
    r.ok(`${name}: refusal carries no processUrl`, !('processUrl' in result), JSON.stringify(result));
  }
}

// Case 5 — readiness() reports the SAME verdict as initiate(), synchronously, before any call.
//
// readiness('initiate') requires OZOW_SANDBOX_API_KEY too (F2b, lib/payments/ozow.ts
// INITIATE_REQUIRED_KEYS doc comment) even though initiate() itself never reads it: it is the
// only readiness gate the checkout route ever calls (readiness('initiate'),
// app/api/tickets/checkout/route.ts:647), and confirmNotification() (F2b) fails closed without
// that key — so a deployment missing only the API key must be reported not-ready here, or a buyer
// could pay under a gateway that can never confirm the payment. This is not part of the
// algorithm-golden fixture (unrelated to the signature), so it is a literal test value here.
const TEST_API_KEY = 'test-ozow-api-key-not-real-0001';
const readyProvider = createOzowProvider({
  env: {
    OZOW_SANDBOX_SITE_CODE: creds.siteCode,
    OZOW_SANDBOX_PRIVATE_KEY: creds.privateKey,
    OZOW_SANDBOX_API_KEY: TEST_API_KEY,
  },
});
const readiness = readyProvider.readiness('initiate');
r.eq('case 5: readiness(initiate) reports ready with full credentials', readiness, { ready: true });
const missingApiKeyProvider = createOzowProvider({
  env: { OZOW_SANDBOX_SITE_CODE: creds.siteCode, OZOW_SANDBOX_PRIVATE_KEY: creds.privateKey },
});
const missingApiKeyReadiness = missingApiKeyProvider.readiness('initiate');
r.ok(
  'case 5: readiness(initiate) reports not-ready when only OZOW_SANDBOX_API_KEY is missing',
  missingApiKeyReadiness.ready === false,
  JSON.stringify(missingApiKeyReadiness)
);
if (missingApiKeyReadiness.ready === false) {
  r.ok(
    'case 5: missing list names OZOW_SANDBOX_API_KEY',
    missingApiKeyReadiness.missing.includes('OZOW_SANDBOX_API_KEY'),
    JSON.stringify(missingApiKeyReadiness)
  );
}
const notReadyProvider = createOzowProvider({ env: {} });
const notReadiness = notReadyProvider.readiness('initiate');
r.ok('case 5: readiness(initiate) reports not-ready with no credentials', notReadiness.ready === false, JSON.stringify(notReadiness));
if (notReadiness.ready === false) {
  r.ok('case 5: missing list names the absent keys', Array.isArray(notReadiness.missing) && notReadiness.missing.length > 0);
}
const verifyReadiness = notReadyProvider.readiness('verify-notification');
r.ok(
  'case 5: readiness(verify-notification) also reports not-ready with no credentials',
  verifyReadiness.ready === false,
  JSON.stringify(verifyReadiness)
);

// Case 6 — CONFIG READ PER CALL, NOT AT CONSTRUCTION.
const mutableEnv = {};
const late = createOzowProvider({ env: mutableEnv });
const before = await late.initiate(g.inputs);
r.ok('case 6: refused while env is empty', before.ok === false, JSON.stringify(before));
mutableEnv.OZOW_SANDBOX_SITE_CODE = creds.siteCode;
mutableEnv.OZOW_SANDBOX_PRIVATE_KEY = creds.privateKey;
const after = await late.initiate(g.inputs);
r.ok('case 6: same instance succeeds once env is populated', after.ok === true, JSON.stringify(after));

r.done();
