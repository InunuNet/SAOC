// ozow-sandbox-toggle F1 — structural (source-position) check that the checkout route applies
// the Ozow-sandbox amount override ONLY to the value handed to paymentProvider.initiate(), and
// never to the value that becomes order.amount or the JSON response's own `amount` echo. Proven
// by identifier reference, the same source-position technique this repo already uses in
// contracts/checks/ticketing-checkout-orders/check-fail-closed-secret-guard.sh — a live
// Firestore transaction would be needed to observe order.amount directly at runtime, which this
// project's contract checks avoid (README §7).
//
// See contracts/golden/ozow-sandbox-toggle-f1/README.md §3.
//
// Run as: node contracts/checks/ozow-sandbox-toggle-f1/check-checkout-route-wiring.mjs

import { readFileSync } from 'node:fs';

const path = 'app/api/tickets/checkout/route.ts';
const src = readFileSync(path, 'utf8');

let FAIL = false;
function fail(msg) {
  console.error(`FAIL: ${msg}`);
  FAIL = true;
}

// 1. The override function must actually be called in this file.
if (!/resolveOzowInitiateAmount\s*\(/.test(src)) {
  fail('resolveOzowInitiateAmount(...) is not called in app/api/tickets/checkout/route.ts');
}

// 2. Its result must be bound to the exact mandated name `initiateAmountFormatted`.
if (!/const\s+initiateAmountFormatted\s*=\s*(?:await\s+)?resolveOzowInitiateAmount\s*\(/.test(src)) {
  fail('resolveOzowInitiateAmount(...) result is not bound to `const initiateAmountFormatted`');
}

// 3. paymentProvider.initiate({ ... }) must use `initiateAmountFormatted` as its
// `amountFormatted` field, not the bare `amountFormatted` identifier.
const initiateCallMatch = src.match(/paymentProvider\.initiate\(\{[\s\S]*?\}\);/);
if (!initiateCallMatch) {
  fail('could not find a paymentProvider.initiate({ ... }) call to inspect');
} else {
  const callBody = initiateCallMatch[0];
  if (!/amountFormatted\s*:\s*initiateAmountFormatted\b/.test(callBody)) {
    fail('paymentProvider.initiate({...}) does not pass amountFormatted: initiateAmountFormatted');
  }
  // Guard against the override leaking in under the bare name too (e.g. both present/aliased).
  if (/amountFormatted\s*:\s*amountFormatted\b/.test(callBody)) {
    fail('paymentProvider.initiate({...}) still passes the un-overridden amountFormatted — override is not wired in');
  }
}

// 4. The JSON response's own `amount:` echo must still use the ORIGINAL amountFormatted
// identifier, never the overridden initiateAmountFormatted — this is the field
// contracts/checks proves stays real-priced even when Ozow test mode is on.
if (!/amount:\s*amountFormatted\b/.test(src)) {
  fail('response JSON does not echo the original `amount: amountFormatted` field unchanged');
}
if (/amount:\s*initiateAmountFormatted\b/.test(src)) {
  fail('response JSON echoes the OVERRIDDEN initiateAmountFormatted instead of the real amount — leaks test-mode price into the response');
}

// 5. isOzowSandboxTestModeEnabled() must be called EXACTLY ONCE in this file — a second,
// independent read could see a different flag value between the two call sites it feeds,
// letting the order's stored expectation and the actual initiate() call disagree (README §3b).
const flagReadMatches = src.match(/isOzowSandboxTestModeEnabled\s*\(/g) || [];
if (flagReadMatches.length !== 1) {
  fail(`isOzowSandboxTestModeEnabled() must be called exactly once in this file, found ${flagReadMatches.length}`);
}

// 6. That single read must be textually BEFORE the reserveTicket() call, so the same boolean
// feeds both resolveExpectedGatewayAmount() (into reserveTicket's input) and
// resolveOzowInitiateAmount() (into initiate()).
const flagReadIndex = src.indexOf('isOzowSandboxTestModeEnabled(');
const reserveTicketIndex = src.indexOf('reserveTicket(');
if (flagReadIndex === -1) {
  fail('isOzowSandboxTestModeEnabled(...) is not called in app/api/tickets/checkout/route.ts');
} else if (reserveTicketIndex === -1) {
  fail('reserveTicket(...) call not found in app/api/tickets/checkout/route.ts');
} else if (flagReadIndex > reserveTicketIndex) {
  fail('isOzowSandboxTestModeEnabled() is called AFTER reserveTicket() — must be read once, before reservation, so the stored expectedGatewayAmount and the initiate() override can never disagree');
}

// 7. resolveExpectedGatewayAmount(...) must be called, and its result passed as reserveTicket's
// input `expectedGatewayAmount` field — otherwise A8's function is called but its result is
// silently discarded, reverting to the pre-fix bug.
if (!/resolveExpectedGatewayAmount\s*\(/.test(src)) {
  fail('resolveExpectedGatewayAmount(...) is not called in app/api/tickets/checkout/route.ts');
}
if (!/expectedGatewayAmount\s*:\s*resolveExpectedGatewayAmount\s*\(/.test(src)) {
  fail('reserveTicket() input does not pass expectedGatewayAmount: resolveExpectedGatewayAmount(...)');
}

// 8. REVISED 2026-08-24 (second Codex cross-model review, README §3c): the identifier
// `ozowSandboxTestModeEnabled` must not appear in any ACTUAL CODE (as opposed to explanatory
// comments — the current correct source legitimately mentions the identifier by name in a
// comment near the initiate() call, describing why it is no longer re-read there) anywhere
// after the resolveExpectedGatewayAmount(...) call that feeds reserveTicket()'s input. Comments
// are stripped first so this observes real identifier usage, not prose that happens to name it.
// This is the source-position proof that the handoff no longer re-reads the live flag state
// (the exact second-review gap: resolveOzowInitiateAmount being called with the flag itself
// rather than the reservation outcome's own expectedGatewayAmount).
function stripComments(code) {
  // Order matters: block comments, then line comments. Naive (does not understand string
  // literals containing `//` or `/*`), but this file has none in a position that matters.
  return code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

const stripped = stripComments(src);
const feedCallPattern = /expectedGatewayAmount\s*:\s*resolveExpectedGatewayAmount\s*\([^)]*\)/;
const feedCallMatch = stripped.match(feedCallPattern);
if (!feedCallMatch) {
  fail('could not locate the resolveExpectedGatewayAmount(...) call feeding reserveTicket()\'s input, in code (non-comment) text');
} else {
  const afterFeedCall = stripped.slice(feedCallMatch.index + feedCallMatch[0].length);
  if (/\bozowSandboxTestModeEnabled\b/.test(afterFeedCall)) {
    fail(
      'ozowSandboxTestModeEnabled is referenced in code AFTER the resolveExpectedGatewayAmount(...) call that feeds reserveTicket() — the handoff must derive the initiate() amount from the reservation outcome, not a second live flag read'
    );
  }
}

if (FAIL) {
  process.exit(1);
}
console.log('PASS: checkout route applies the Ozow-sandbox override only to the initiate() call, never to the response amount echo, and threads a single flag read into both the initiate() override and the stored expectedGatewayAmount.');
