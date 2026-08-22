#!/usr/bin/env node
// A7 — ORIGINALLY: confirmNotification() IS A DECLARED STUB IN THIS FEATURE (F1), NOT AN INVENTED
// REST CALL. Ozow's REST status-check API (ApiKey-authed) is what confirmNotification would
// eventually call, but its field-level request/response contract could not be independently
// verified at F1 time: the domain the earlier spec cited for it, oldhub.ozow.com, no longer
// resolves (checked via Alembic 2026-08-22, NXDOMAIN — see README.md §5), and no live replacement
// documentation was found then.
//
// ⚠️ SUPERSEDED 2026-08-22 by F2b (contracts/golden/ozow-m1-f2b/README.md): Ozow's own current
// integrations page documents a LIVE GetTransactionByReference status API, and confirmNotification
// is now a real, fail-closed call against it — see check-confirm-notification-real.mjs (F2b/A1)
// for the full behavioural spec. This F1 check still has a role: given a FULLY CONFIGURED
// environment (site code + API key both present, matching this feature's own credentials golden)
// and a fetch that always throws, confirmNotification must still fail closed rather than ever
// return confirmed:true or throw uncaught — it just now does so via a real (rejected) network
// attempt (reason 'request-failed'), not via a config-guard short-circuit (reason
// 'not-configured'). The zero-network-calls property this check originally asserted no longer
// holds for a configured environment, by design (F2b), and is not re-asserted here.
//
// WHAT MAKES THIS FAIL: the module not existing; confirmNotification() throwing instead of
// returning; confirmNotification() ever returning confirmed:true (a silent lie) when the injected
// fetch always throws.
//
// Run as: npx tsx contracts/checks/ozow-m1-f1/check-confirm-declared-stub.mjs

import { createOzowProvider } from '../../../lib/payments/ozow.ts';
import { golden, makeReporter, fakeNotifyRequest } from './_golden.mjs';

const r = makeReporter('A7 confirmNotification fails closed (superseded by F2b — see header)');
const g = golden.inbound;
const creds = golden.credentials;

let fetchCalls = 0;
const provider = createOzowProvider({
  env: { OZOW_SANDBOX_SITE_CODE: creds.siteCode, OZOW_SANDBOX_PRIVATE_KEY: creds.privateKey, OZOW_SANDBOX_API_KEY: 'test-api-key-not-real' },
  fetch: async () => {
    fetchCalls += 1;
    throw new Error('confirmNotification() must not make a network call in this feature');
  },
});

// Get a real ProviderNotification via a genuine verifyNotification() call first — confirmNotification
// takes the notification the verify step produced, not a raw request (interface holds unchanged).
const verifyResult = await provider.verifyNotification(fakeNotifyRequest({ ...g.complete.fields, Hash: g.complete.hashCheck }));
r.ok('setup: verifyNotification succeeds so confirmNotification has a real input', verifyResult.verified === true);

if (verifyResult.verified) {
  // Case 1 — returns the explicit non-confirmation, by value, without throwing, even though
  // (post-F2b) it does now attempt a real network call that the injected fetch rejects.
  let result;
  try {
    result = await provider.confirmNotification(verifyResult.notification);
  } catch (error) {
    r.ok('case 1: confirmNotification refuses by return value, never by throwing', false, String(error));
    result = null;
  }
  r.eq('case 1: refusal shape', result, { confirmed: false, reason: 'request-failed' });

  // Case 2 — the network attempt was made (post-F2b), and rejected by the injected fetch.
  r.eq('case 2: one fetch call attempted, and rejected', fetchCalls, 1);

  // Case 3 — NON-VACUITY.
  r.eq('case 3: confirmNotification is a function on the provider', typeof provider.confirmNotification, 'function');
  r.ok('case 3: and it returns a promise', result !== null);
}

r.done();
