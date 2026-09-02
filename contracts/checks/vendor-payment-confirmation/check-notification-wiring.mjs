#!/usr/bin/env node
// vendor-payment-confirmation F1 -- A2: source-level wiring discriminator on
// lib/vendor-stand-payment-notification.ts.
//
// REWRITTEN 2026-09-02 (team lead's direct instruction) after F6 (vendor-stand-payment-
// confirm-gate) moved paymentProvider.confirmNotification() OUTSIDE and BEFORE
// db.runTransaction(...) -- a real security fix (a Firestore retry re-invoking confirm inside
// the transaction callback could silently lose a real settlement). That restructuring gives the
// 'paid' branch its own db.runTransaction(...) block nested inside `if (status === 'paid')`,
// and the 'failed'/'cancelled' branch its own SEPARATE db.runTransaction(...) block for the
// same read-then-write atomicity -- TWO transaction blocks in the file where this check
// previously required exactly one. The old check counted transactions as a proxy for
// correctness; that was never the actual property. Rewritten to assert the INTENT instead:
//
//   (a) still imports sendVendorPaymentAdminNoticeEmail
//   (b) also imports sendVendorPaymentConfirmationEmail from '@/lib/vendor-payment-confirmation'
//   (c) both sends are wrapped in deliverConfirmationEmailAfterCommit
//   (d) NEITHER call site sits inside ANY db.runTransaction(...) callback, however many the
//       file contains -- a transaction can retry; a side effect inside one would double-send
//   (e) both call sites sit inside THE SAME textual `if (paidNotice) { ... }` block
//   (f) `transaction.get(submissionRef)` appears EXACTLY ONCE in the whole file -- contactEmail
//       is sourced from that single existing in-transaction read, never a second fetch
//   (g) ANTI-STALE-READ: no read of submissionRef (transaction.get(submissionRef) or a bare
//       submissionRef.get()) occurs ANYWHERE OUTSIDE a db.runTransaction(...) block after the
//       settlement transaction (the one that contains the submissionRef read and populates
//       paidNotice) closes -- proves contactEmail is never re-fetched fresh after commit. This
//       is scoped to "outside any transaction" specifically so the file's own SECOND, unrelated
//       db.runTransaction(...) block (the failed/cancelled path, which never touches
//       submissionRef) is not mistaken for a violation -- transaction COUNT is deliberately not
//       constrained; only a bare, non-transactional re-read after settlement is forbidden.
//
// Deliberately NOT re-imposed: "exactly one db.runTransaction(...) block in the file" and
// "no transaction.get() at all after the first block closes" -- both were true only of the
// pre-F6 single-transaction topology and would reject @dev's correct, mandated F6 restructuring
// (which needs a second transaction for the failed/cancelled path). See the golden README's
// "A2 no longer constrains transaction count" note for the full record -- do not restore either
// rule.
//
// Source-level discriminator, self-tested against FIVE frozen fixtures: fully unwired, admin-
// only, vendor-send-fired-from-inside-the-settlement-transaction (now alongside a second,
// unrelated, legitimate transaction -- proving the "inside ANY transaction" check isn't fooled
// by transaction count), vendor-send-in-a-SECOND-if-block-with-a-post-commit-re-read (same,
// alongside a second legitimate transaction -- proving a real stale-read defect is still caught
// even when a second transaction is textually present), and a KNOWN-GOOD two-transaction
// fixture mirroring the real F6 topology (proves the discriminator does NOT reject the
// legitimate multi-transaction shape it must now accept).
//
// Mirrors contracts/checks/vendor-flow-notifications/check-payment-admin-notice-wiring.mjs's
// brace-counted transaction-block-location technique, generalised to multiple blocks.
//
// Run as: node contracts/checks/vendor-payment-confirmation/check-notification-wiring.mjs

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');

const FULLY_UNWIRED_FIXTURE = `
export async function POST(paymentProvider, request, deps) {
  await db.runTransaction(async (transaction) => {
    const orderDoc = await transaction.get(standOrderRef);
    if (status === 'paid') {
      const submissionDoc = await transaction.get(submissionRef);
      transaction.update(standOrderRef, { status: 'paid', paidAt: now });
      transaction.update(submissionRef, { paymentReceived: true });
      return;
    }
  });
  return acknowledge();
}
`;

// The real shape of the file with only the EXISTING admin notice wired -- vendor receipt
// entirely absent. This check must reject this too, or it is vacuously satisfied.
const ADMIN_ONLY_FIXTURE = `
import { sendVendorPaymentAdminNoticeEmail } from '@/lib/vendor-payment-admin-notice';

export async function POST(paymentProvider, request, deps) {
  let paidNotice = null;
  await db.runTransaction(async (transaction) => {
    paidNotice = null;
    const orderDoc = await transaction.get(standOrderRef);
    if (status === 'paid') {
      const submissionDoc = await transaction.get(submissionRef);
      paidNotice = { businessName: 'x', contactPersonName: 'y', standOrderRef: 'VSO-x' };
      transaction.update(standOrderRef, { status: 'paid', paidAt: now });
      transaction.update(submissionRef, { paymentReceived: true });
      return;
    }
  });
  if (paidNotice) {
    await deliverConfirmationEmailAfterCommit(
      () => sendVendorPaymentAdminNoticeEmail({ ...paidNotice, reviewUrl: 'x' }),
      onError,
    );
  }
  return acknowledge();
}
`;

// Post-F6 TWO-transaction topology (settlement transaction nested in the 'paid' branch, a
// separate transaction for the 'failed'/'cancelled' branch) -- but the vendor-receipt send is
// still fired from INSIDE the settlement transaction callback (a plausible real mistake: "just
// fire it right after the write since I already have the data here"). Must be rejected for the
// same double-send-on-retry reason as the admin notice's own existing requirement, AND the
// presence of a second, legitimate, unrelated transaction block must not mask this.
const VENDOR_SEND_INSIDE_TRANSACTION_FIXTURE = `
import { sendVendorPaymentAdminNoticeEmail } from '@/lib/vendor-payment-admin-notice';
import { sendVendorPaymentConfirmationEmail } from '@/lib/vendor-payment-confirmation';

export async function POST(paymentProvider, request, deps) {
  let paidNotice = null;
  if (status === 'paid') {
    await db.runTransaction(async (transaction) => {
      paidNotice = null;
      const orderDoc = await transaction.get(standOrderRef);
      const submissionDoc = await transaction.get(submissionRef);
      paidNotice = { businessName: 'x', contactEmail: 'x@example.com', boothSize: 1, amount: 1450, standOrderRef: 'VSO-x' };
      transaction.update(standOrderRef, { status: 'paid', paidAt: now });
      transaction.update(submissionRef, { paymentReceived: true });
      await deliverConfirmationEmailAfterCommit(
        () => sendVendorPaymentConfirmationEmail(paidNotice),
        onError,
      );
    });
  } else if (status === 'failed' || status === 'cancelled') {
    await db.runTransaction(async (transaction) => {
      const orderDoc = await transaction.get(standOrderRef);
      transaction.update(standOrderRef, { status, failedAt: now });
    });
  }
  if (paidNotice) {
    await deliverConfirmationEmailAfterCommit(
      () => sendVendorPaymentAdminNoticeEmail({ ...paidNotice, reviewUrl: 'x' }),
      onError,
    );
  }
  return acknowledge();
}
`;

// Post-F6 TWO-transaction topology, both sends correctly outside every transaction -- but the
// vendor send lives in a SECOND, separately-gated `if (paidNotice)` block, and (compounding the
// mistake) re-fetches contactEmail via a fresh, non-transactional, post-commit
// `submissionRef.get()` instead of reading it off the value already captured inside the
// settlement transaction. A plausible real mistake: "the existing paidNotice doesn't have
// contactEmail on it, so fetch it separately down here." Must be rejected on BOTH grounds, and
// the second, legitimate, unrelated transaction block present in this fixture must not mask
// either defect.
const SECOND_IF_BLOCK_WITH_POST_COMMIT_READ_FIXTURE = `
import { sendVendorPaymentAdminNoticeEmail } from '@/lib/vendor-payment-admin-notice';
import { sendVendorPaymentConfirmationEmail } from '@/lib/vendor-payment-confirmation';

export async function POST(paymentProvider, request, deps) {
  let paidNotice = null;
  if (status === 'paid') {
    await db.runTransaction(async (transaction) => {
      paidNotice = null;
      const orderDoc = await transaction.get(standOrderRef);
      const submissionDoc = await transaction.get(submissionRef);
      paidNotice = { businessName: 'x', contactPersonName: 'y', standOrderRef: 'VSO-x' };
      transaction.update(standOrderRef, { status: 'paid', paidAt: now });
      transaction.update(submissionRef, { paymentReceived: true });
    });
  } else if (status === 'failed' || status === 'cancelled') {
    await db.runTransaction(async (transaction) => {
      const orderDoc = await transaction.get(standOrderRef);
      transaction.update(standOrderRef, { status, failedAt: now });
    });
  }
  if (paidNotice) {
    await deliverConfirmationEmailAfterCommit(
      () => sendVendorPaymentAdminNoticeEmail({ ...paidNotice, reviewUrl: 'x' }),
      onError,
    );
  }
  const freshSubmissionSnapshot = await submissionRef.get();
  const contactEmail = freshSubmissionSnapshot.data()?.contactEmail;
  if (paidNotice && contactEmail) {
    await deliverConfirmationEmailAfterCommit(
      () => sendVendorPaymentConfirmationEmail({ ...paidNotice, contactEmail }),
      onError,
    );
  }
  return acknowledge();
}
`;

// KNOWN-GOOD: the real post-F6 topology this check must now ACCEPT -- two db.runTransaction(...)
// blocks (settlement, and a separate one for failed/cancelled), a non-transactional PRE-read of
// standOrderRef before either transaction (F6's confirm-gate optimisation, irrelevant to this
// check), both sends wrapped and fired from the SAME `if (paidNotice)` block strictly outside
// every transaction, and no re-read of submissionRef anywhere after the settlement transaction
// closes. Proves the discriminator does not reject the legitimate shape it must now accept, and
// is not merely counting transactions.
const TWO_TRANSACTION_WIRED_FIXTURE = `
import { sendVendorPaymentAdminNoticeEmail } from '@/lib/vendor-payment-admin-notice';
import { sendVendorPaymentConfirmationEmail } from '@/lib/vendor-payment-confirmation';

export async function POST(paymentProvider, request, deps) {
  let paidNotice = null;
  const preReadSnapshot = await standOrderRef.get();
  if (status === 'paid') {
    const confirmation = await paymentProvider.confirmNotification(notification);
    if (!confirmation.confirmed) {
      return acknowledge();
    }
    await db.runTransaction(async (transaction) => {
      paidNotice = null;
      const orderDoc = await transaction.get(standOrderRef);
      const submissionDoc = await transaction.get(submissionRef);
      paidNotice = { businessName: 'x', contactPersonName: 'y', contactEmail: 'x@example.com', boothSize: 1, amount: 1450, standOrderRef: 'VSO-x' };
      transaction.update(standOrderRef, { status: 'paid', paidAt: now });
      transaction.update(submissionRef, { paymentReceived: true });
    });
  } else if (status === 'failed' || status === 'cancelled') {
    await db.runTransaction(async (transaction) => {
      const orderDoc = await transaction.get(standOrderRef);
      transaction.update(standOrderRef, { status, failedAt: now });
    });
  }
  if (paidNotice) {
    const adminNoticePromise = deliverConfirmationEmailAfterCommit(
      () => sendVendorPaymentAdminNoticeEmail({ ...paidNotice, reviewUrl: 'x' }),
      onError,
    );
    const vendorReceiptPromise = deliverConfirmationEmailAfterCommit(
      () => sendVendorPaymentConfirmationEmail(paidNotice),
      onError,
    );
    await Promise.allSettled([adminNoticePromise, vendorReceiptPromise]);
  }
  return acknowledge();
}
`;

/** Finds every `db.runTransaction(async (transaction) => { ... })` block (brace-counted) in
 *  `source`, returning [{start, braceStart, end}, ...] in source order. Any number of blocks
 *  is legitimate post-F6 -- this check never treats the COUNT as meaningful on its own. */
function findAllTransactionBlocks(source) {
  const blocks = [];
  const openRegex = /db\.runTransaction\s*\(\s*async\s*\(\s*transaction\s*\)\s*=>\s*\{/g;
  let openMatch;
  while ((openMatch = openRegex.exec(source)) !== null) {
    const braceStart = openMatch.index + openMatch[0].length - 1;
    let depth = 0;
    for (let i = braceStart; i < source.length; i += 1) {
      if (source[i] === '{') depth += 1;
      if (source[i] === '}') {
        depth -= 1;
        if (depth === 0) {
          blocks.push({ start: openMatch.index, braceStart, end: i });
          openRegex.lastIndex = i + 1;
          break;
        }
      }
    }
  }
  return blocks;
}

/** Finds every `if (paidNotice) { ... }` block (brace-counted), returning [{start, end}, ...]. */
function findPaidNoticeIfBlocks(source) {
  const blocks = [];
  const ifRegex = /if\s*\(\s*paidNotice\s*\)\s*\{/g;
  let match;
  while ((match = ifRegex.exec(source)) !== null) {
    const braceStart = match.index + match[0].length - 1;
    let depth = 0;
    for (let i = braceStart; i < source.length; i += 1) {
      if (source[i] === '{') depth += 1;
      if (source[i] === '}') {
        depth -= 1;
        if (depth === 0) {
          blocks.push({ start: match.index, end: i });
          break;
        }
      }
    }
  }
  return blocks;
}

/** Finds every full, PAREN-MATCHED `deliverConfirmationEmailAfterCommit(...)` call whose body
 *  contains a call to `fnName`, returning [{index}, ...] where `index` is the start of the
 *  `deliverConfirmationEmailAfterCommit(` call itself. Paren-matched (not a lazy `[\s\S]*?`
 *  regex) so that when TWO separate wrapped calls sit near each other -- exactly the "two
 *  separate `if (paidNotice)` blocks" shape this check must detect -- a lazy match starting at
 *  the FIRST wrapper cannot skip past its own closing paren and accidentally swallow the
 *  SECOND, unrelated wrapper's call, which would collapse both functions' detected indices onto
 *  the same wrapper and silently blind the block-identity check (e). */
function findCallSites(source, fnName) {
  const results = [];
  const openRegex = /deliverConfirmationEmailAfterCommit\s*\(/g;
  let match;
  while ((match = openRegex.exec(source)) !== null) {
    const parenStart = match.index + match[0].length - 1;
    let depth = 0;
    let end = -1;
    for (let i = parenStart; i < source.length; i += 1) {
      if (source[i] === '(') depth += 1;
      if (source[i] === ')') {
        depth -= 1;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
    if (end === -1) {
      break;
    }
    const callBody = source.slice(match.index, end + 1);
    const fnCallRegex = new RegExp(`\\b${fnName}\\s*\\(`);
    if (fnCallRegex.test(callBody)) {
      results.push({ index: match.index });
    }
    openRegex.lastIndex = end + 1;
  }
  return results;
}

/** Finds every full, PAREN-MATCHED `deliverConfirmationEmailAfterCommit(...)` call span
 *  (regardless of which function it wraps), returning [{start, end}, ...] in source order.
 *  Used to strip wrapped calls before scanning for a BARE, unwrapped call -- paren-matched for
 *  the same reason findCallSites is: a lazy strip could eat past one wrapper's close into a
 *  second, unrelated wrapper. */
function findWrappedCallSpans(source) {
  const spans = [];
  const openRegex = /deliverConfirmationEmailAfterCommit\s*\(/g;
  let match;
  while ((match = openRegex.exec(source)) !== null) {
    const parenStart = match.index + match[0].length - 1;
    let depth = 0;
    let end = -1;
    for (let i = parenStart; i < source.length; i += 1) {
      if (source[i] === '(') depth += 1;
      if (source[i] === ')') {
        depth -= 1;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
    if (end === -1) {
      break;
    }
    spans.push({ start: match.index, end });
    openRegex.lastIndex = end + 1;
  }
  return spans;
}

/** Returns the substring of `source` from `fromIndex` to the end, with the text of every
 *  transaction block whose `start >= fromIndex` removed -- i.e. "everything after fromIndex
 *  that is NOT inside any db.runTransaction(...) callback". This is the region a post-commit,
 *  non-transactional re-read would have to appear in to be a real anti-stale-read violation;
 *  it deliberately does not penalise a second, later, unrelated transaction block for existing. */
function textOutsideLaterTransactions(source, fromIndex, allBlocks) {
  const laterBlocks = allBlocks
    .filter((b) => b.start >= fromIndex)
    .sort((a, b) => a.start - b.start);
  let result = '';
  let cursor = fromIndex;
  for (const block of laterBlocks) {
    result += source.slice(cursor, block.start);
    cursor = block.end + 1;
  }
  result += source.slice(cursor);
  return result;
}

function isWired(source) {
  const failures = [];

  const importsAdminNotice =
    /import\s*\{[^}]*\bsendVendorPaymentAdminNoticeEmail\b[^}]*\}\s*from\s*['"]@\/lib\/vendor-payment-admin-notice['"]/.test(
      source,
    );
  if (!importsAdminNotice) {
    failures.push('missing import of sendVendorPaymentAdminNoticeEmail from @/lib/vendor-payment-admin-notice (the EXISTING admin notice must not be lost)');
  }

  const importsVendorConfirmation =
    /import\s*\{[^}]*\bsendVendorPaymentConfirmationEmail\b[^}]*\}\s*from\s*['"]@\/lib\/vendor-payment-confirmation['"]/.test(
      source,
    );
  if (!importsVendorConfirmation) {
    failures.push('missing import of sendVendorPaymentConfirmationEmail from @/lib/vendor-payment-confirmation');
  }

  const allTxBlocks = findAllTransactionBlocks(source);
  if (allTxBlocks.length === 0) {
    failures.push('could not locate any db.runTransaction(async (transaction) => { ... }) block');
    return { wired: false, failures };
  }

  // (f) transaction.get(submissionRef) must appear exactly once anywhere in the file.
  const submissionGetMatches = [...source.matchAll(/transaction\.get\s*\(\s*submissionRef\s*\)/g)];
  if (submissionGetMatches.length !== 1) {
    failures.push(`transaction.get(submissionRef) appears ${submissionGetMatches.length} time(s), expected exactly 1 -- contactEmail must be sourced from this single existing read, never a second fetch`);
  }

  // The settlement transaction is whichever block actually contains the submissionRef read --
  // NOT "the first block" (post-F6, the failed/cancelled branch may have its own, textually
  // earlier or later, entirely unrelated transaction). If submissionGetMatches didn't find
  // exactly one, we still try to locate a settlement block for the remaining checks so a
  // multi-defect file reports all its defects, not just the first.
  const settlementBlock =
    allTxBlocks.find((b) => {
      const inner = source.slice(b.start, b.end);
      return /transaction\.get\s*\(\s*submissionRef\s*\)/.test(inner);
    }) ?? allTxBlocks[allTxBlocks.length - 1];

  // (g) ANTI-STALE-READ: no read of submissionRef, anywhere OUTSIDE a transaction block, after
  // the settlement transaction closes. Deliberately does NOT flag a read inside a different,
  // later, legitimate db.runTransaction(...) block (e.g. the failed/cancelled path's own
  // transaction) -- transaction count is not the property being protected here.
  const afterSettlementOutsideTx = textOutsideLaterTransactions(source, settlementBlock.end, allTxBlocks);
  const postCommitReadRegex = /transaction\.get\s*\(\s*submissionRef\s*\)|submissionRef\s*\.\s*get\s*\(/g;
  if (postCommitReadRegex.test(afterSettlementOutsideTx)) {
    failures.push('a read of submissionRef occurs after the settlement transaction closes, outside of any transaction -- contactEmail must come from the in-transaction read, never a post-commit re-fetch');
  }

  const paidNoticeIfBlocks = findPaidNoticeIfBlocks(source).filter(
    (b) => b.start > settlementBlock.end,
  );

  const callSitesByFn = {};
  for (const [label, fnName] of [
    ['sendVendorPaymentAdminNoticeEmail', 'sendVendorPaymentAdminNoticeEmail'],
    ['sendVendorPaymentConfirmationEmail', 'sendVendorPaymentConfirmationEmail'],
  ]) {
    const matches = findCallSites(source, fnName);
    callSitesByFn[fnName] = matches;
    if (matches.length === 0) {
      failures.push(`${label} is never called wrapped inside deliverConfirmationEmailAfterCommit(() => ...)`);
      continue;
    }
    // (d) must not fall inside ANY transaction block, however many the file has.
    const insideAnyTransaction = matches.some((m) =>
      allTxBlocks.some((b) => m.index >= b.start && m.index <= b.end),
    );
    if (insideAnyTransaction) {
      failures.push(`${label} is fired from INSIDE a db.runTransaction callback -- a retry would double-send it`);
    }
    const outsideAfter = matches.some((m) => m.index > settlementBlock.end);
    if (!outsideAfter) {
      failures.push(`${label} never appears strictly after the settlement transaction closes`);
    }

    // Strip every PAREN-MATCHED deliverConfirmationEmailAfterCommit(...) call body (not a lazy
    // regex -- see findCallSites' own comment for why a lazy strip is unsafe once two wrapped
    // calls sit near each other) before checking for a bare, unwrapped call to fnName.
    const bareCallRegex = new RegExp(`(?<!=>\\s{0,200})${fnName}\\s*\\(`, 'g');
    const wrappedSpans = findWrappedCallSpans(source);
    let sourceWithoutWrappedCalls = '';
    let cursor = 0;
    for (const span of wrappedSpans) {
      sourceWithoutWrappedCalls += source.slice(cursor, span.start);
      cursor = span.end + 1;
    }
    sourceWithoutWrappedCalls += source.slice(cursor);
    const bareCall = bareCallRegex.test(sourceWithoutWrappedCalls);
    if (bareCall) {
      failures.push(`${label} appears to have a call site NOT wrapped in deliverConfirmationEmailAfterCommit`);
    }
  }

  // (e) both call sites must fall inside the SAME `if (paidNotice) { ... }` block.
  if (callSitesByFn.sendVendorPaymentAdminNoticeEmail?.length && callSitesByFn.sendVendorPaymentConfirmationEmail?.length) {
    const adminIdx = callSitesByFn.sendVendorPaymentAdminNoticeEmail[0].index;
    const vendorIdx = callSitesByFn.sendVendorPaymentConfirmationEmail[0].index;
    const adminBlock = paidNoticeIfBlocks.find((b) => adminIdx >= b.start && adminIdx <= b.end);
    const vendorBlock = paidNoticeIfBlocks.find((b) => vendorIdx >= b.start && vendorIdx <= b.end);
    if (!adminBlock) {
      failures.push('sendVendorPaymentAdminNoticeEmail\'s call site is not inside any `if (paidNotice) { ... }` block after the settlement transaction');
    }
    if (!vendorBlock) {
      failures.push('sendVendorPaymentConfirmationEmail\'s call site is not inside any `if (paidNotice) { ... }` block after the settlement transaction');
    }
    if (adminBlock && vendorBlock && adminBlock.start !== vendorBlock.start) {
      failures.push('sendVendorPaymentAdminNoticeEmail and sendVendorPaymentConfirmationEmail are gated by TWO SEPARATE `if (paidNotice)` blocks, not the same one -- they must share a single block');
    }
  }

  return { wired: failures.length === 0, failures };
}

// Self-test: the discriminator must reject all four frozen KNOWN-BAD fixtures, and must ACCEPT
// the KNOWN-GOOD two-transaction fixture (proving it does not reject the legitimate post-F6
// shape it now must allow).
for (const [name, fixture] of [
  ['FULLY_UNWIRED_FIXTURE', FULLY_UNWIRED_FIXTURE],
  ['ADMIN_ONLY_FIXTURE', ADMIN_ONLY_FIXTURE],
  ['VENDOR_SEND_INSIDE_TRANSACTION_FIXTURE', VENDOR_SEND_INSIDE_TRANSACTION_FIXTURE],
  ['SECOND_IF_BLOCK_WITH_POST_COMMIT_READ_FIXTURE', SECOND_IF_BLOCK_WITH_POST_COMMIT_READ_FIXTURE],
]) {
  const selfTest = isWired(fixture);
  if (selfTest.wired) {
    console.error(`FAIL (self-test): discriminator accepted the KNOWN-BAD fixture "${name}" -- the discriminator itself is broken.`);
    process.exit(1);
  }
}
{
  const selfTest = isWired(TWO_TRANSACTION_WIRED_FIXTURE);
  if (!selfTest.wired) {
    console.error('FAIL (self-test): discriminator rejected the KNOWN-GOOD TWO_TRANSACTION_WIRED_FIXTURE (the real post-F6 topology) -- the discriminator itself is broken.');
    selfTest.failures.forEach((f) => console.error(`  - ${f}`));
    process.exit(1);
  }
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
  'PASS: lib/vendor-stand-payment-notification.ts fires both sendVendorPaymentAdminNoticeEmail ' +
    'and sendVendorPaymentConfirmationEmail from inside the SAME `if (paidNotice)` block, each ' +
    'wrapped in deliverConfirmationEmailAfterCommit, neither inside any db.runTransaction(...) ' +
    'block (however many the file has); transaction.get(submissionRef) appears exactly once ' +
    'with no post-commit re-read outside a transaction; the discriminator rejects all four ' +
    'known-bad fixtures and accepts the known-good two-transaction post-F6 shape.',
);
process.exit(0);
