#!/usr/bin/env node
// vendor-stand-payment-confirm-gate F1 -- A2: source-level wiring discriminator on
// lib/vendor-stand-payment-notification.ts.
//
// THE DEFECT (verified by the team lead directly in source, 2026-09-02): the settlement
// handler's 'paid' branch flips a vendorStandOrders doc to 'paid' on nothing but its own inbound
// signature verification -- it never calls `paymentProvider.confirmNotification()`, the
// gateway's own out-of-band server-confirm round trip. lib/tickets-notification.ts (the sibling
// TICKET settlement path) already closed exactly this hole at its own step 8. Anyone holding the
// gateway passphrase (materially weaker than compromising the gateway itself) can forge a
// correctly-signed ITN and settle a stand order as paid with no money moving.
//
// This check proves the settlement handler's 'paid' branch:
//   (a) calls `paymentProvider.confirmNotification(notification)`
//   (b) BEFORE the write that flips the order to 'paid'
//       (`transaction.update(standOrderRef, { status: 'paid', ... })`)
//   (c) and that an unconfirmed result (`confirmation.confirmed` falsy, for ANY reason -- this
//       project's audited "assertion satisfiable by something that isn't the real property"
//       defect class means a check must never accept an implementation that special-cases one
//       failure reason, e.g. trusting `not-configured` as if it were a pass) is followed by a
//       `return` before that same write is ever reached.
//
// Source-level discriminator, self-tested against FOUR frozen fixtures: today's real unwired
// shape (no confirm call at all -- proves this check is not already vacuously satisfied),
// confirm-called-but-result-ignored (a call exists but nothing gates the write on it),
// confirm-called-after-the-write (the call exists and is checked, but too late to prevent the
// forged settlement), and a CORRECTLY-WIRED positive control (proves the discriminator is not
// simply rejecting everything -- a broken discriminator that fails every input would still make
// this check "pass" against unimplemented code, which is the exact false-positive shape this
// project has been burned by before).
//
// Run as: node contracts/checks/vendor-stand-payment-confirm-gate/check-confirm-gate-wiring.mjs

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');

// Today's real pre-fix shape (2026-09-02 ground truth) -- amount guard, then straight to the
// submission read + write. No confirmNotification call anywhere.
const UNWIRED_FIXTURE = `
export async function POST(paymentProvider, request, deps) {
  await db.runTransaction(async (transaction) => {
    if (status === 'paid') {
      const orderAmountCents = Number.isFinite(order?.amount) ? Math.round(Number(order?.amount) * 100) : null;
      if (orderAmountCents === null || notification.grossAmountCents === null || notification.grossAmountCents !== orderAmountCents) {
        console.error('amount mismatch');
        return;
      }
      const submissionDoc = await transaction.get(submissionRef);
      const submission = submissionDoc.data();
      if (submission?.businessName && submission.contactPersonName) {
        paidNotice = { businessName: submission.businessName, contactPersonName: submission.contactPersonName, standOrderRef: notification.reference, contactEmail: submission.contactEmail ?? null, boothSize: order?.boothSize, amount: order?.amount };
      }
      const now = Timestamp.now();
      transaction.update(standOrderRef, { status: 'paid', paidAt: now, gatewayPaymentId: notification.gatewayPaymentId });
      transaction.update(submissionRef, { paymentReceived: true });
      return;
    }
  });
  return acknowledge();
}
`;

// A call exists, but nothing gates the write on its result -- the write happens unconditionally
// right after. A plausible half-fix: someone added the call to "log" the confirmation without
// realising the whole point is to BLOCK the write on failure.
const CONFIRM_IGNORED_FIXTURE = `
export async function POST(paymentProvider, request, deps) {
  await db.runTransaction(async (transaction) => {
    if (status === 'paid') {
      if (orderAmountCents === null || notification.grossAmountCents !== orderAmountCents) {
        return;
      }
      const confirmation = await paymentProvider.confirmNotification(notification);
      console.log('confirmation result', confirmation);
      const submissionDoc = await transaction.get(submissionRef);
      const submission = submissionDoc.data();
      paidNotice = { businessName: submission.businessName, contactPersonName: submission.contactPersonName, standOrderRef: notification.reference };
      const now = Timestamp.now();
      transaction.update(standOrderRef, { status: 'paid', paidAt: now, gatewayPaymentId: notification.gatewayPaymentId });
      transaction.update(submissionRef, { paymentReceived: true });
      return;
    }
  });
  return acknowledge();
}
`;

// A call exists AND is checked -- but only AFTER the write has already happened. The forged
// notification has already settled the order by the time the (too-late) rejection fires.
const CONFIRM_AFTER_WRITE_FIXTURE = `
export async function POST(paymentProvider, request, deps) {
  await db.runTransaction(async (transaction) => {
    if (status === 'paid') {
      if (orderAmountCents === null || notification.grossAmountCents !== orderAmountCents) {
        return;
      }
      const submissionDoc = await transaction.get(submissionRef);
      const submission = submissionDoc.data();
      const now = Timestamp.now();
      transaction.update(standOrderRef, { status: 'paid', paidAt: now, gatewayPaymentId: notification.gatewayPaymentId });
      transaction.update(submissionRef, { paymentReceived: true });
      const confirmation = await paymentProvider.confirmNotification(notification);
      if (!confirmation.confirmed) {
        console.error('too late, already written');
        return;
      }
      paidNotice = { businessName: submission.businessName, contactPersonName: submission.contactPersonName, standOrderRef: notification.reference };
      return;
    }
  });
  return acknowledge();
}
`;

// POSITIVE CONTROL -- the intended fix shape: confirm called, checked, gates the write. Proves
// the discriminator can actually accept a correct implementation (not just reject everything).
const CORRECTLY_WIRED_FIXTURE = `
export async function POST(paymentProvider, request, deps) {
  await db.runTransaction(async (transaction) => {
    if (status === 'paid') {
      if (orderAmountCents === null || notification.grossAmountCents !== orderAmountCents) {
        return;
      }
      const confirmation = await paymentProvider.confirmNotification(notification);
      if (!confirmation.confirmed) {
        console.error('[vendors/stand-payment] Server confirmation failed -- rejecting notification', { reason: confirmation.reason });
        return;
      }
      const submissionDoc = await transaction.get(submissionRef);
      const submission = submissionDoc.data();
      if (submission?.businessName && submission.contactPersonName) {
        paidNotice = { businessName: submission.businessName, contactPersonName: submission.contactPersonName, standOrderRef: notification.reference };
      }
      const now = Timestamp.now();
      transaction.update(standOrderRef, { status: 'paid', paidAt: now, gatewayPaymentId: notification.gatewayPaymentId });
      transaction.update(submissionRef, { paymentReceived: true });
      return;
    }
  });
  return acknowledge();
}
`;

/** Finds { start, braceStart, end } for the FIRST `if (status === 'paid') {` block, brace-counted
 *  (a plain regex can't find the matching close brace of an arbitrarily-nested block). */
function findPaidBlock(source) {
  const openMatch = /if\s*\(\s*status\s*===\s*['"]paid['"]\s*\)\s*\{/.exec(source);
  if (!openMatch) return null;
  const braceStart = openMatch.index + openMatch[0].length - 1;
  let depth = 0;
  for (let i = braceStart; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    if (source[i] === '}') {
      depth -= 1;
      if (depth === 0) return { start: openMatch.index, braceStart, end: i };
    }
  }
  return null;
}

function isGated(source) {
  const failures = [];

  const paidBlock = findPaidBlock(source);
  if (!paidBlock) {
    failures.push("could not locate the if (status === 'paid') { ... } block");
    return { gated: false, failures };
  }
  const block = source.slice(paidBlock.braceStart, paidBlock.end + 1);

  const confirmRegex = /paymentProvider\.confirmNotification\s*\(\s*notification\s*\)/;
  const confirmMatch = confirmRegex.exec(block);
  if (!confirmMatch) {
    failures.push("paymentProvider.confirmNotification(notification) is never called inside the 'paid' branch");
    return { gated: false, failures };
  }
  const confirmIdx = confirmMatch.index;

  const writeRegex = /transaction\.update\(\s*standOrderRef\s*,\s*\{\s*status:\s*['"]paid['"]/;
  const writeMatch = writeRegex.exec(block);
  if (!writeMatch) {
    failures.push("could not locate the transaction.update(standOrderRef, { status: 'paid', ... }) write inside the 'paid' branch");
    return { gated: false, failures };
  }
  const writeIdx = writeMatch.index;

  if (confirmIdx > writeIdx) {
    failures.push(
      "paymentProvider.confirmNotification() is called AFTER the order is already written 'paid' -- the forged notification has already settled the order by the time confirmation is checked",
    );
  }

  // The stretch of source between the confirm call and the write must contain a guard that (a)
  // references confirmation.confirmed and (b) returns -- i.e. an unconfirmed result must abort
  // BEFORE the write, for any reason, not just a specific one.
  const between = confirmIdx < writeIdx ? block.slice(confirmIdx, writeIdx) : '';
  const gateRegex = /confirmation\.confirmed[\s\S]{0,300}?return;/;
  if (confirmIdx < writeIdx && !gateRegex.test(between)) {
    failures.push(
      'a call to confirmNotification() exists before the write, but nothing between the call and the write checks confirmation.confirmed and returns on failure -- an unconfirmed notification still falls through to the write',
    );
  }

  return { gated: failures.length === 0, failures };
}

// Self-test: the discriminator must reject all three known-bad fixtures and accept the positive
// control.
for (const [name, fixture, expected] of [
  ["UNWIRED_FIXTURE (today's real pre-fix shape)", UNWIRED_FIXTURE, false],
  ['CONFIRM_IGNORED_FIXTURE', CONFIRM_IGNORED_FIXTURE, false],
  ['CONFIRM_AFTER_WRITE_FIXTURE', CONFIRM_AFTER_WRITE_FIXTURE, false],
  ['CORRECTLY_WIRED_FIXTURE (positive control)', CORRECTLY_WIRED_FIXTURE, true],
]) {
  const selfTest = isGated(fixture);
  if (selfTest.gated !== expected) {
    console.error(
      `FAIL (self-test): discriminator ${expected ? 'rejected the CORRECT fixture' : 'accepted the KNOWN-BAD fixture'} "${name}" -- the discriminator itself is broken.`,
    );
    if (selfTest.failures.length) {
      selfTest.failures.forEach((f) => console.error(`  - ${f}`));
    }
    process.exit(1);
  }
}

const targetPath = path.join(REPO_ROOT, 'lib/vendor-stand-payment-notification.ts');
if (!existsSync(targetPath)) {
  console.error(`FAIL: ${targetPath} does not exist.`);
  process.exit(1);
}

const result = isGated(readFileSync(targetPath, 'utf8'));

if (!result.gated) {
  result.failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${result.failures.length} assertion(s) failed against ${targetPath}.`);
  process.exit(1);
}

console.log(
  "PASS: the 'paid' branch of lib/vendor-stand-payment-notification.ts calls " +
    'paymentProvider.confirmNotification(notification) before the order is written paid, and ' +
    'an unconfirmed result returns before that write; the discriminator rejects all three ' +
    'known-bad fixtures and accepts the positive control.',
);
process.exit(0);
