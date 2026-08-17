#!/usr/bin/env node
// F6 (ticketing-foundation) — design constraint 8: the resend-my-tickets endpoint must return
// the SAME response whether or not the email matches a real order, AND whether or not the
// request was rate-limited (spec §8.2(b): "Rate-limit hits are logged but don't expose an error
// message to the attacker; the response is the same 'check your email' message in all cases.").
// A response that differs by status code, body, or shape leaks which addresses bought tickets.
//
// This checks REFERENCE equality, not just deep equality — decideResendOutcome() is required to
// hand back the exact same shared RESEND_MY_TICKETS_PUBLIC_RESPONSE object every time, which is
// a stronger, structurally-enforced guarantee than "two separately-built objects that happen to
// currently look the same" (the latter can silently drift the moment one branch is edited and
// the other isn't).
//
// Timing-channel equality (whether the two code paths take measurably different WALL-CLOCK time
// to respond) is explicitly NOT proven here — see the golden README, "What this contract does
// NOT prove."
//
// Run as: node --import tsx/esm contracts/checks/ticketing-f6-recovery-token/check-resend-response-shape-identity.mjs

import { decideResendOutcome, RESEND_MY_TICKETS_PUBLIC_RESPONSE } from '../../../lib/resend-response.ts';

const failures = [];

const combinations = [
  { orderMatched: true, rateLimited: false, expectedShouldSend: true, expectedLogReason: 'sent' },
  { orderMatched: false, rateLimited: false, expectedShouldSend: false, expectedLogReason: 'no-match' },
  { orderMatched: true, rateLimited: true, expectedShouldSend: false, expectedLogReason: 'rate-limited' },
  { orderMatched: false, rateLimited: true, expectedShouldSend: false, expectedLogReason: 'rate-limited' },
];

for (const combo of combinations) {
  const result = decideResendOutcome({ orderMatched: combo.orderMatched, rateLimited: combo.rateLimited });

  // The identity check: same object reference, not merely matching content.
  if (result.publicResponse !== RESEND_MY_TICKETS_PUBLIC_RESPONSE) {
    failures.push(
      `(orderMatched=${combo.orderMatched}, rateLimited=${combo.rateLimited}) publicResponse is NOT the same reference as RESEND_MY_TICKETS_PUBLIC_RESPONSE — a freshly-built object risks silently drifting in shape from the matched/unmatched/rate-limited branches. Got: ${JSON.stringify(result.publicResponse)}.`
    );
  }

  if (result.shouldSend !== combo.expectedShouldSend) {
    failures.push(
      `(orderMatched=${combo.orderMatched}, rateLimited=${combo.rateLimited}) shouldSend was ${result.shouldSend}, expected ${combo.expectedShouldSend} — the identical public response must not mean the function is a no-op that ignores its input.`
    );
  }

  if (result.logReason !== combo.expectedLogReason) {
    failures.push(
      `(orderMatched=${combo.orderMatched}, rateLimited=${combo.rateLimited}) logReason was '${result.logReason}', expected '${combo.expectedLogReason}'.`
    );
  }
}

// Explicit cross-combination identity check: every result's publicResponse must be the exact
// same reference as every other result's, not just each individually equal to the constant.
{
  const results = combinations.map((c) => decideResendOutcome({ orderMatched: c.orderMatched, rateLimited: c.rateLimited }));
  const distinctReferences = new Set(results.map((r) => r.publicResponse));
  if (distinctReferences.size !== 1) {
    failures.push(`(cross-check) The four combinations produced ${distinctReferences.size} distinct publicResponse object references, expected exactly 1 — a leak vector if any branch constructs its own response object.`);
  }
}

// The public response body must never mention 'matched', 'found', 'exists', or similar —
// guards against a future edit accidentally interpolating the match result into the message.
const bodyText = JSON.stringify(RESEND_MY_TICKETS_PUBLIC_RESPONSE.body).toLowerCase();
for (const leakyWord of ['not found', 'no such', 'invalid email', 'does not exist', "doesn't exist"]) {
  if (bodyText.includes(leakyWord)) {
    failures.push(`(leak) RESEND_MY_TICKETS_PUBLIC_RESPONSE.body contains the phrase '${leakyWord}', which would leak match status to the caller.`);
  }
}
if (RESEND_MY_TICKETS_PUBLIC_RESPONSE.status !== 200) {
  failures.push(`(leak) RESEND_MY_TICKETS_PUBLIC_RESPONSE.status is ${RESEND_MY_TICKETS_PUBLIC_RESPONSE.status}, expected 200 for every case including no-match and rate-limited — a differing status code is itself an enumeration oracle.`);
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log(
  'PASS: decideResendOutcome() returns the exact same publicResponse object reference — same ' +
    'status, same body — across all four combinations of orderMatched/rateLimited, while ' +
    'shouldSend/logReason correctly differ, proving the identical response is a deliberate ' +
    'design, not a no-op. No enumeration-leaking phrase or differing status code found.',
);
process.exit(0);
