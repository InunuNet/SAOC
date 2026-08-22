#!/usr/bin/env node
// A1 — OUTBOUND SIGNATURE MATCHES OZOW'S DOCUMENTED ALGORITHM, verified independently via
// Alembic against https://ozow.com/integrations and https://api.i-pay.co.za/guide/payment
// (2026-08-22, see contracts/golden/ozow-m1-f1/README.md §1): concatenate the 17 documented post
// variables (excluding HashCheck) IN THE DOCUMENTED ORDER, append the private key, lowercase the
// whole string, SHA512 it. Tested at TWO levels: lib/ozow.ts's primitive builder directly (case
// 1-2), and through lib/payments/ozow.ts's initiate() (case 3), so a correct primitive wired up
// wrong still fails.
//
// WHAT MAKES THIS FAIL: either module not existing (pre-implementation); any field renamed,
// added, dropped or reordered; the private key prepended instead of appended, or folded in as a
// query param (PayFast's shape, not Ozow's); the string not lowercased; HashCheck computed over
// key=value pairs instead of bare values (this is NOT PayFast's param-string shape); a wrong
// digest algorithm.
//
// Run as: npx tsx contracts/checks/ozow-m1-f1/check-outbound-signature.mjs

import { buildOzowConcatString, generateOzowHash, OZOW_OUTBOUND_FIELD_ORDER, OZOW_PAY_URL } from '../../../lib/ozow.ts';
import { createOzowProvider } from '../../../lib/payments/ozow.ts';
import { golden, makeReporter } from './_golden.mjs';

const r = makeReporter('A1 outbound signature equivalence');
const g = golden.outbound;
const creds = golden.credentials;

// Case 1 — field order matches the golden exactly (order IS the signature base string; a Set
// comparison here would not catch a reorder).
r.eq('case 1: OZOW_OUTBOUND_FIELD_ORDER matches Ozow docs', [...OZOW_OUTBOUND_FIELD_ORDER], g.fieldOrder);

// Case 2 — the primitive builder reproduces the golden concat string and hash directly, offline,
// with no network call and no provider wiring involved.
const concat = buildOzowConcatString(g.signedFields, OZOW_OUTBOUND_FIELD_ORDER);
r.eq('case 2: concatenated string (pre-secret, pre-lowercase)', concat.toLowerCase(), g.concatenatedString.toLowerCase());
const hash = generateOzowHash(g.signedFields, OZOW_OUTBOUND_FIELD_ORDER, creds.privateKey);
r.eq('case 2: HashCheck', hash, g.hashCheck);

// Case 3 — NON-VACUITY. Reversing field order must change the digest, proving order is load-
// bearing rather than the builder silently sorting or ignoring it.
const reversedHash = generateOzowHash(g.signedFields, [...OZOW_OUTBOUND_FIELD_ORDER].reverse(), creds.privateKey);
r.eq('case 3: reversed-order hash matches golden (order really is load-bearing)', reversedHash, g.hashCheckWithFieldsReversed);
r.ok('case 3: reversed-order hash differs from correct hash', reversedHash !== g.hashCheck);

// Case 4 — through the real provider. initiate() maps InitiateInput -> Ozow's field set per this
// contract's documented decisions (README §4: BankReference = reference, ErrorUrl = cancelUrl,
// CountryCode/CurrencyCode/IsTest are adapter constants) and signs with the exact same algorithm.
const provider = createOzowProvider({
  env: { OZOW_SANDBOX_SITE_CODE: creds.siteCode, OZOW_SANDBOX_PRIVATE_KEY: creds.privateKey },
});
const result = await provider.initiate(g.inputs);
r.ok('case 4: initiate succeeds with full credentials', result.ok === true, JSON.stringify(result));
if (result.ok) {
  r.eq('case 4: processUrl is the real Ozow pay URL', result.processUrl, OZOW_PAY_URL);
  r.eq('case 4: method', result.method, 'POST');
  r.eq('case 4: SiteCode', result.fields.SiteCode, creds.siteCode);
  r.eq('case 4: CountryCode', result.fields.CountryCode, g.adapterOwnedConstants.countryCode);
  r.eq('case 4: CurrencyCode', result.fields.CurrencyCode, g.adapterOwnedConstants.currencyCode);
  r.eq('case 4: Amount', result.fields.Amount, g.inputs.amountFormatted);
  r.eq('case 4: TransactionReference', result.fields.TransactionReference, g.inputs.reference);
  r.eq('case 4: BankReference == reference (this contract\'s decision)', result.fields.BankReference, g.inputs.reference);
  r.eq('case 4: SuccessUrl == input.returnUrl', result.fields.SuccessUrl, g.inputs.returnUrl);
  r.eq('case 4: CancelUrl == input.cancelUrl', result.fields.CancelUrl, g.inputs.cancelUrl);
  r.eq('case 4: ErrorUrl == input.cancelUrl (this contract\'s decision)', result.fields.ErrorUrl, g.inputs.cancelUrl);
  r.eq('case 4: NotifyUrl == input.notifyUrl', result.fields.NotifyUrl, g.inputs.notifyUrl);
  r.eq('case 4: IsTest is hardcoded true (sandbox-only scope)', result.fields.IsTest, 'true');
  r.eq('case 4: HashCheck', result.fields.HashCheck, g.hashCheck);
  // itemName must not appear on the wire — Ozow has no line-item-name field (spec §1).
  r.ok('case 4: no stray itemName field on the wire', !('itemName' in result.fields) && !('ItemName' in result.fields));
}

r.done();
