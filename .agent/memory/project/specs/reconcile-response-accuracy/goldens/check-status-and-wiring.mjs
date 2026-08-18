#!/usr/bin/env node
// reconcile-response-accuracy F1 — two things, kept in one script:
//
//   Part 1 (A3, load-bearing): reconcileStatusFor() — a small pure function mapping
//   alertBookkeepingFailed.length to an HTTP status — returns 207 when nonempty, 200 when
//   empty. A real behavioural proof, narrow in scope: it only proves the mapping, not that
//   route.ts calls it, hence Part 2.
//
//   Part 2 (A3 wiring + A5, structural, NON-LOAD-BEARING FAST-FAIL ONLY): pattern checks
//   against route.ts's source (comments stripped) proving markOrdersAlertedForResponse()/
//   reconcileStatusFor() are actually called and alertBookkeepingFailed is actually surfaced
//   in the response body (A3 wiring), and that the flag-only write boundary is untouched (A5,
//   no markOrderAndPositionPaidByPaymentId / pf_payment_id reference). These are cheap,
//   fast-failing sanity checks layered ON TOP of check-response-splits-partial-failure.mjs's
//   real behavioural proof — NOT a substitute for it. A route that imported reconcileStatusFor
//   but called it with the wrong argument would pass every pattern here and still be wrong.
//
// AUTH IS DELIBERATELY *NOT* CHECKED STRUCTURALLY HERE ANYMORE. History, briefly (full account
// in this contract's git log / session transcript, 2026-08-19):
//   1st version matched raw source including comments — route.ts's own doc comments legitimately
//   NAME `markOrderAndPositionPaidByPaymentId` and `RECONCILIATION_CRON_SECRET` to STATE the
//   properties being checked, so a bare substring match either false-failed on a correct route
//   (naming the forbidden function in a comment) or would have false-passed a broken one
//   (naming the secret in a comment after the real check was deleted). Fixed by stripping
//   comments before matching.
//   2nd version still matched a bare, comment-stripped IDENTIFIER for the auth guard
//   (`constantTimeEqual|timingSafeEqual`) — @qa satisfied it with nothing but an unused import,
//   guard block fully deleted. Fixed by requiring CALL shape: `if (!constantTimeEqual(...))`.
//   3rd bypass (this one): @qa left the `if (!constantTimeEqual(...)) { ... }` condition
//   completely intact and commented out only the `return unauthorized();` inside it — the
//   guard's text still matched perfectly, but the guarded code no longer refused anything;
//   the route logged "Bearer secret mismatch" and processed the request regardless of the
//   secret. No text pattern can distinguish "this condition is checked" from "this condition's
//   consequence actually fires" — that is a CONTROL-FLOW property, not a text property, and
//   every regex refinement on this axis just relocates the next bypass one line over
//   (comparing a buffer against itself is the next one nobody has demonstrated yet).
//
// CONCLUSION, per architect + team-lead decision: stop hardening the regex. Auth correctness
// is proven ONLY by order-reconciliation F1's `check-route-auth-fails-closed.sh` — real HTTP,
// against the real compiled route, with credentials scrubbed, asserting an actual 401 for both
// no-header and wrong-secret requests. No control-flow mutation (deleted return, commented-out
// return, buffer-compared-against-itself, or any variant not yet thought of) can produce a 401
// by accident; all of them produce some other status and fail that check directly, because it
// exercises the REAL runtime behaviour, not a proxy for it. This contract's A6 IS that script,
// run unmodified — see contract-f1.yaml A6's command. This file contains NO auth pattern check
// of any kind; do not re-add one under the assumption it is a harmless "extra" layer — the
// false comment implying a structural check gave any real coverage here is exactly what misled
// two reviewers in a row.
//
// Run as:
//   npx tsx .agent/memory/project/specs/reconcile-response-accuracy/goldens/check-status-and-wiring.mjs

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { reconcileStatusFor } from '../../../../../../lib/reconciliation.ts';

const failures = [];

// --- Part 1: reconcileStatusFor pure-function mapping (load-bearing) ------------------------
{
  const partial = reconcileStatusFor(['order-B']);
  if (partial !== 207) {
    failures.push(`reconcileStatusFor(['order-B']) expected 207, got ${JSON.stringify(partial)}`);
  }
  const clean = reconcileStatusFor([]);
  if (clean !== 200) {
    failures.push(`reconcileStatusFor([]) expected 200, got ${JSON.stringify(clean)}`);
  }
}

// --- Part 2: structural wiring / boundary checks against route.ts (fast-fail convenience,
// NOT proof — see header) --------------------------------------------------------------------
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const routePath = path.resolve(
  __dirname,
  '../../../../../../app/api/admin/reconcile-orders/route.ts'
);
const routeSource = readFileSync(routePath, 'utf8');

// route.ts has no string literal containing `//` or `/*` (verified by hand), so a plain
// block-comment/line-comment strip is safe here without a full tokenizer. Still only tells you
// what text is present in code vs. in a comment — never whether that code's CONTROL FLOW
// actually does what it appears to (see header: this is exactly the axis auth checking was
// removed from this file over).
function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}
const routeCode = stripComments(routeSource);

function requireMatch(pattern, label) {
  if (!pattern.test(routeCode)) {
    failures.push(`route.ts wiring: expected to find ${label} in actual code (not a comment), but did not.`);
  }
}
function requireAbsent(pattern, label) {
  if (pattern.test(routeCode)) {
    failures.push(
      `route.ts boundary: found ${label} in actual code (not a comment), which must never appear in this route.`
    );
  }
}

// A3 (wiring half): the route must call the new response-shaping functions and surface both
// fields — a route that reverted to the old inline try/catch (the original bug) would fail
// these, even though Part 1 above still passes (Part 1 only proves the function is correct in
// isolation, not that anything calls it). Layered on top of, not a substitute for,
// check-response-splits-partial-failure.mjs's real proof.
requireMatch(/markOrdersAlertedForResponse\s*\(/, 'a call to markOrdersAlertedForResponse(');
requireMatch(/reconcileStatusFor\s*\(/, 'a call to reconcileStatusFor(');
requireMatch(/alertBookkeepingFailed/, 'alertBookkeepingFailed in the response body');

// A5: flag-only write boundary, unchanged from order-reconciliation F1's own structural
// guarantee — this fix must not add any new write surface. A presence/absence check is an
// acceptable proxy here specifically because there is no "guard whose consequence might not
// fire" shape to this property — the property is simply "this identifier is never referenced",
// which text matching CAN fully decide (unlike the auth guard's control-flow property above).
requireAbsent(
  /markOrderAndPositionPaidByPaymentId/,
  'an import/reference to markOrderAndPositionPaidByPaymentId (the only status-flipping write)'
);
requireAbsent(/pf_payment_id/, 'a reference to pf_payment_id (a PayFast-lookup field)');

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log(
  'PASS: reconcileStatusFor() maps a nonempty alertBookkeepingFailed to 207 and an empty one to ' +
    '200 (load-bearing); route.ts wires in the new response-shaping functions and surfaces ' +
    'alertBookkeepingFailed, and the flag-only write boundary is unreferenced (fast-fail ' +
    'convenience only — see contract-f1.yaml A6 / check-route-auth-fails-closed.sh for the ' +
    'actual, load-bearing proof that the auth guard refuses; this script asserts NOTHING about ' +
    'auth).'
);
process.exit(0);
