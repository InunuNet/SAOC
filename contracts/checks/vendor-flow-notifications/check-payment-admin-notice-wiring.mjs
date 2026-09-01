#!/usr/bin/env node
// G1 (vendor-flow-notifications) — A5: wiring discriminator on
// lib/vendor-stand-payment-notification.ts. Proves the payment-received admin notice:
//   (a) imports sendVendorPaymentAdminNoticeEmail from '@/lib/vendor-payment-admin-notice'
//   (b) reads submissionRef via transaction.get() BEFORE the first transaction.update() call
//       inside the SAME transaction callback (Firestore requires every transaction.get() to
//       precede every transaction.set/update/delete in one transaction — a real runtime error,
//       not a style preference)
//   (c) the admin-notice send is wrapped in deliverConfirmationEmailAfterCommit
//   (d) that call site sits OUTSIDE the db.runTransaction(...) callback entirely — strictly
//       after the transaction's closing, never inside it (a transaction can retry; a side
//       effect inside it would double-send on every retry)
//
// Source-level discriminator, self-tested against a frozen KNOWN-UNWIRED fixture.
//
// DEFEATING MUTATION: deleting the admin-notice call; reading submissionRef only via
// transaction.get() AFTER a transaction.update() call (a real Firestore crash, not merely a
// style nit); firing the admin-notice send from INSIDE the transaction callback (double-send
// risk on retry); calling sendVendorPaymentAdminNoticeEmail unwrapped.
//
// Run as: node contracts/checks/vendor-flow-notifications/check-payment-admin-notice-wiring.mjs

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');

const KNOWN_UNWIRED_FIXTURE = `
export async function POST(paymentProvider, request, deps) {
  await db.runTransaction(async (transaction) => {
    const orderDoc = await transaction.get(standOrderRef);
    if (status === 'paid') {
      transaction.update(standOrderRef, { status: 'paid', paidAt: now });
      transaction.update(submissionRef, { paymentReceived: true });
      return;
    }
  });
  return acknowledge();
}
`;

/** Finds the source index of the matching closing '}' for the FIRST
 *  \`db.runTransaction(async (transaction) => {\` block (brace-counted), or null. */
function findTransactionBlock(source) {
  const openMatch = /db\.runTransaction\s*\(\s*async\s*\(\s*transaction\s*\)\s*=>\s*\{/.exec(source);
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

function isWired(source) {
  const failures = [];

  const importsAdminNotice =
    /import\s*\{[^}]*\bsendVendorPaymentAdminNoticeEmail\b[^}]*\}\s*from\s*['"]@\/lib\/vendor-payment-admin-notice['"]/.test(
      source,
    );
  if (!importsAdminNotice) {
    failures.push('missing import of sendVendorPaymentAdminNoticeEmail from @/lib/vendor-payment-admin-notice');
  }

  const txBlock = findTransactionBlock(source);
  if (!txBlock) {
    failures.push('could not locate the db.runTransaction(async (transaction) => { ... }) block');
    return { wired: false, failures };
  }
  const txBody = source.slice(txBlock.braceStart, txBlock.end + 1);

  const getSubmissionIndex = txBody.search(/transaction\.get\s*\(\s*submissionRef\s*\)/);
  const firstUpdateIndex = txBody.search(/transaction\.update\s*\(/);

  if (getSubmissionIndex === -1) {
    failures.push('transaction.get(submissionRef) is never called inside the transaction — the admin notice has no source of businessName/contactPersonName');
  } else if (firstUpdateIndex !== -1 && getSubmissionIndex > firstUpdateIndex) {
    failures.push('transaction.get(submissionRef) is called AFTER a transaction.update() in the same transaction — Firestore requires every get() before every write in one transaction');
  }

  const adminNoticeCallRegex = /deliverConfirmationEmailAfterCommit\s*\(\s*\(\)\s*=>\s*[\s\S]*?sendVendorPaymentAdminNoticeEmail\s*\(/g;
  const matches = [...source.matchAll(adminNoticeCallRegex)];

  if (matches.length === 0) {
    failures.push('sendVendorPaymentAdminNoticeEmail is never called wrapped inside deliverConfirmationEmailAfterCommit(() => ...)');
  } else {
    const insideTransaction = matches.some((m) => m.index >= txBlock.start && m.index <= txBlock.end);
    if (insideTransaction) {
      failures.push('the admin-notice send is fired from INSIDE the db.runTransaction callback — a retry would double-send it');
    }
    const outsideAfter = matches.some((m) => m.index > txBlock.end);
    if (!outsideAfter) {
      failures.push('the admin-notice send never appears strictly after the db.runTransaction(...) block closes');
    }
  }

  const bareCall = /(?<!=>\s{0,200})sendVendorPaymentAdminNoticeEmail\s*\(/.test(
    source.replace(adminNoticeCallRegex, ''),
  );
  if (bareCall) {
    failures.push('sendVendorPaymentAdminNoticeEmail appears to have a call site NOT wrapped in deliverConfirmationEmailAfterCommit');
  }

  return { wired: failures.length === 0, failures };
}

// Self-test: the discriminator must reject the frozen known-unwired fixture.
const selfTest = isWired(KNOWN_UNWIRED_FIXTURE);
if (selfTest.wired) {
  console.error('FAIL (self-test): discriminator accepted the KNOWN-UNWIRED fixture — the discriminator itself is broken.');
  process.exit(1);
}

const targetPath = path.join(REPO_ROOT, 'lib/vendor-stand-payment-notification.ts');
if (!existsSync(targetPath)) {
  console.error(`FAIL: ${targetPath} does not exist.`);
  process.exit(1);
}

const result = isWired(readFileSync(targetPath, 'utf8'));

if (!result.wired) {
  result.failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${result.failures.length} assertion(s) failed against ${targetPath}.`);
  process.exit(1);
}

console.log(
  'PASS: lib/vendor-stand-payment-notification.ts reads submissionRef before any transaction ' +
    'write, fires sendVendorPaymentAdminNoticeEmail through deliverConfirmationEmailAfterCommit ' +
    'strictly outside the transaction, and the discriminator rejects the known-unwired fixture.',
);
process.exit(0);
