#!/usr/bin/env node
// F10 (ticketing-foundation) — "money is more important than a delivery receipt". Mission
// brief: an email failure must NOT roll back or lose a legitimate payment. The ITN route
// commits the order/position transaction FIRST, then calls
// deliverConfirmationEmailAfterCommit() (lib/confirmation-email.ts) strictly after — this
// check proves that wrapper genuinely swallows a send failure rather than letting it
// propagate, which is what the pinned route's own response depends on: the route does not
// (and structurally cannot, by the sha256 pin — see A8 in the contract) branch its HTTP
// response on the outcome of this call.
//
// WHAT THIS DOES NOT PROVE, named explicitly rather than silently assumed: that the route
// handler itself, exercised end to end over real HTTP with a real payment, still returns 200
// when the email genuinely fails to send. That would require driving guard 4's live
// PayFast sandbox network call, which this contract's hard constraints forbid (offline,
// credential-free, no network). The sha256 pin over the architect-authored expected route
// file is the substitute proof that the route wires this exact wrapper in after the commit
// and does not consult its result for the response — see the golden README's "What this
// contract does NOT prove".
//
// DIMENSION THAT VARIES ACROSS CASES: whether the injected `send` function throws
// synchronously, rejects asynchronously, or succeeds — checked personally to confirm the
// resolved-without-throwing behaviour isn't vacuous by including a success case (3) where
// onError must NOT be called, alongside the two failure shapes.
//
// Run as: npx tsx contracts/checks/ticketing-f10-itn-repin/check-email-failure-does-not-block.mjs

import { deliverConfirmationEmailAfterCommit } from '../../../lib/confirmation-email.ts';

const failures = [];

// (1) send() REJECTS asynchronously (the realistic Resend-call-fails shape).
{
  const seenErrors = [];
  const boom = new Error('simulated Resend failure');
  let threw = false;
  try {
    await deliverConfirmationEmailAfterCommit(
      () => Promise.reject(boom),
      (error) => seenErrors.push(error)
    );
  } catch {
    threw = true;
  }

  if (threw) failures.push('(1) deliverConfirmationEmailAfterCommit propagated a rejected send() instead of swallowing it — a caller (the ITN route, after a committed payment) would see this as an uncaught rejection.');
  if (seenErrors.length !== 1) failures.push(`(1) onError was called ${seenErrors.length} time(s), expected exactly 1.`);
  if (seenErrors[0] !== boom) failures.push('(1) onError was not called with the original error — the failure was not surfaced for reconciliation, only silently eaten.');
}

// (2) send() THROWS synchronously (a defensive shape — a badly-written sender might throw
// before ever returning a promise).
{
  const seenErrors = [];
  let threw = false;
  try {
    await deliverConfirmationEmailAfterCommit(
      () => {
        throw new Error('synchronous failure');
      },
      (error) => seenErrors.push(error)
    );
  } catch {
    threw = true;
  }

  if (threw) failures.push('(2) deliverConfirmationEmailAfterCommit propagated a SYNCHRONOUSLY thrown error instead of swallowing it.');
  if (seenErrors.length !== 1) failures.push(`(2) onError was called ${seenErrors.length} time(s), expected exactly 1.`);
}

// (3) NON-VACUOUS POSITIVE CONTROL — send() succeeds, onError must NOT be called. Without
// this case, a wrapper that ALWAYS calls onError (e.g. always logging a spurious failure,
// masking whether the email genuinely sent) would still pass (1) and (2).
{
  let sent = false;
  let errorCalled = false;
  await deliverConfirmationEmailAfterCommit(
    async () => {
      sent = true;
    },
    () => {
      errorCalled = true;
    }
  );

  if (!sent) failures.push('(3) the send() function was never actually invoked on the success path.');
  if (errorCalled) failures.push('(3) onError was called even though send() succeeded — a mutation that always reports failure would still pass cases (1)/(2) but must fail here.');
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log(
  'PASS: deliverConfirmationEmailAfterCommit() never propagates a send failure (synchronous ' +
    'throw or async rejection alike) — it always resolves, always reports the real failure to ' +
    'onError exactly once, and never calls onError when the send genuinely succeeds. This is ' +
    "the wrapper the pinned ITN route calls strictly AFTER the order/position transaction " +
    'commits — see the golden README for what this does and does not prove end to end.'
);
process.exit(0);
