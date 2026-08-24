// ozow-sandbox-toggle F1 — NEW 2026-08-24 (second Codex GPT-5.5 cross-model review, README §3c).
// Source-position/identifier check on `reserveTicket()` in app/api/tickets/checkout/route.ts,
// proving BOTH ReservationOutcome branches source `expectedGatewayAmount` correctly and neither
// branch re-derives it independently:
//   1. the `kind: 'created'` return object includes `expectedGatewayAmount:
//      input.expectedGatewayAmount` — the SAME value already threaded into
//      buildMultiReservationDocs for this transaction's order write, not a second,
//      independently-computed value.
//   2. the `kind: 'replayed'` return object sources `expectedGatewayAmount` from
//      `orderData['expectedGatewayAmount']` (with a `?? null` fallback), never from
//      `input.expectedGatewayAmount` (which reflects the CURRENT request's flag read, not the
//      original request's).
//   3. no call to `resolveExpectedGatewayAmount(...)` appears anywhere inside the replay branch
//      (the `duplicate.empty` false path) — that function is called exactly once in the whole
//      file, in POST(), before reserveTicket() is invoked at all (proven by A3).
//
// Proven by source-position/identifier reference, the same technique this repo already uses in
// contracts/checks/ticketing-checkout-orders/check-fail-closed-secret-guard.sh — a live
// Firestore transaction (both a fresh reservation AND a replay of it) would be needed to observe
// this at runtime, which this project's contract checks avoid (README §7).
//
// See contracts/golden/ozow-sandbox-toggle-f1/README.md §3c.
//
// Run as: node contracts/checks/ozow-sandbox-toggle-f1/check-reservation-outcome-expected-amount-sourcing.mjs

import { readFileSync } from 'node:fs';

const path = 'app/api/tickets/checkout/route.ts';
const src = readFileSync(path, 'utf8');

let FAIL = false;
function fail(msg) {
  console.error(`FAIL: ${msg}`);
  FAIL = true;
}

// Locate the two branches inside reserveTicket() by their unique structural anchors:
// - the replay branch is the whole `if (!duplicate.empty) { ... }` block, which in this file
//   ends right before the fresh-reservation path begins at
//   `const requestedQtyByType = aggregateRequestedQuantities(...)`.
// - the 'created' return sits at the end of the fresh-reservation path, after that point.
const replayBranchStart = src.indexOf('if (!duplicate.empty) {');
const freshPathMarker = 'const requestedQtyByType = aggregateRequestedQuantities(';
const freshPathStart = src.indexOf(freshPathMarker);

if (replayBranchStart === -1) {
  fail('could not locate the `if (!duplicate.empty) {` replay branch in app/api/tickets/checkout/route.ts');
}
if (freshPathStart === -1) {
  fail(`could not locate the fresh-reservation path marker ("${freshPathMarker}") after the replay branch`);
}

if (!FAIL) {
  if (freshPathStart <= replayBranchStart) {
    fail('the fresh-reservation path marker appears before (or at) the replay branch start — cannot isolate the replay branch by source position');
  } else {
    const replayBranchText = src.slice(replayBranchStart, freshPathStart);
    const afterReplayBranchText = src.slice(freshPathStart);

    // 1. The 'created' return object includes `expectedGatewayAmount: input.expectedGatewayAmount`,
    // sourced from the fresh-reservation path (after the replay branch), never from the replay
    // branch itself.
    const createdBlockMatch = afterReplayBranchText.match(/kind:\s*'created'[\s\S]*?\n\s*\};/);
    if (!createdBlockMatch) {
      fail("could not locate the `kind: 'created'` return object after the replay branch");
    } else if (!/expectedGatewayAmount\s*:\s*input\.expectedGatewayAmount\b/.test(createdBlockMatch[0])) {
      fail(
        "the `kind: 'created'` return object does not include `expectedGatewayAmount: input.expectedGatewayAmount` — would leave A3's destructuring reading `undefined`, silently reverting initiate() to the bare-amount pass-through path even in test mode"
      );
    }

    // 2. The 'replayed' return object, INSIDE the replay branch, sources expectedGatewayAmount
    // from orderData['expectedGatewayAmount'] (with a ?? null fallback), never from
    // input.expectedGatewayAmount.
    const replayedBlockMatch = replayBranchText.match(/kind:\s*'replayed'[\s\S]*?\n\s*\};/);
    if (!replayedBlockMatch) {
      fail("could not locate the `kind: 'replayed'` return object inside the replay branch");
    } else {
      const replayedBlock = replayedBlockMatch[0];
      const sourcesFromOrderData =
        /expectedGatewayAmount\s*:\s*\(?\s*orderData\[\s*['"]expectedGatewayAmount['"]\s*\][\s\S]*?\?\?\s*null/.test(
          replayedBlock
        );
      if (!sourcesFromOrderData) {
        fail(
          "the `kind: 'replayed'` return object does not source `expectedGatewayAmount` from `orderData['expectedGatewayAmount'] ?? null`"
        );
      }
      if (/expectedGatewayAmount\s*:\s*input\.expectedGatewayAmount\b/.test(replayedBlock)) {
        fail(
          "the `kind: 'replayed'` return object sources `expectedGatewayAmount` from `input.expectedGatewayAmount` — this IS the exact second-review bug: a fresh flag read (this request's, not the original request's) leaking into a replay"
        );
      }
    }

    // 3. No fresh call to resolveExpectedGatewayAmount(...) inside the replay branch — that
    // function is called exactly once in the whole file, in POST(), before reserveTicket() at
    // all (A3 proves the single call site and its position; this proves the replay branch
    // itself never adds a second one).
    if (/resolveExpectedGatewayAmount\s*\(/.test(replayBranchText)) {
      fail(
        'resolveExpectedGatewayAmount(...) is called inside the replay branch — a second, independently-computed value that could disagree with what is actually stored on the order'
      );
    }
  }
}

if (FAIL) {
  process.exit(1);
}
console.log(
  "PASS: reserveTicket()'s 'created' branch sources expectedGatewayAmount from input.expectedGatewayAmount, its 'replayed' branch sources it from the existing order's own orderData['expectedGatewayAmount'] ?? null, and no fresh resolveExpectedGatewayAmount(...) call appears inside the replay branch."
);
