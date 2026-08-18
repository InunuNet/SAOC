#!/usr/bin/env node
// F8 (vendor-registration) — A5: route-wiring discriminator, both directions, on
// app/api/admin/vendors/[id]/review/route.ts. Same technique as F6's A8/F7's A9: proves the
// CALL SITE is wired correctly (imports the real functions, calls them exactly once, wrapped
// in the real isolation helper, gated to the 'approve' action only, positioned after the
// write commits) — not merely that the pure functions work in isolation.
//
// THE ONE DELIBERATE SOURCE-LEVEL EXCEPTION IN THIS CONTRACT, same justification as F6's A8:
// proving the real POST handler's behaviour over HTTP requires a live Firebase Auth session
// and a live Firestore project, outside this contract's offline/credential-free constraint.
//
// This check does NOT trust its own discriminator by assertion alone: it first runs the SAME
// discriminator against TWO frozen KNOWN-UNWIRED fixtures (both must be rejected) and this
// contract's own architect-authored WIRED golden (must be accepted), and refuses to check the
// live repository file at all unless the discriminator passes all three self-tests.
//
// DEFEATING MUTATION: deleting the email call entirely (KNOWN-UNWIRED fixture #1); moving the
// call outside the 'approve' guard so it also fires for reject/start-review (KNOWN-UNWIRED
// fixture #2); calling sendVendorApprovalConfirmationEmail directly without the
// deliverConfirmationEmailAfterCommit wrapper; or moving the call before
// `ref.update(decision.patch)`.
//
// Run as: node --import tsx/esm contracts/checks/vendor-f8-approval-email/check-route-wiring.mjs

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');

const failures = [];

/** Finds the index of the `{` that opens `if (body.action === 'approve') {` and returns the
 *  index of its MATCHING closing `}` (brace-counted, not a naive next-`}` scan), or null if the
 *  guard isn't present at all. */
function findApproveGuardBlock(source) {
  const openMatch = /if\s*\(\s*body\.action\s*===\s*'approve'\s*\)\s*\{/.exec(source);
  if (!openMatch) return null;

  const braceStart = openMatch.index + openMatch[0].length - 1; // index of the `{` itself
  let depth = 0;
  for (let i = braceStart; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    if (source[i] === '}') {
      depth -= 1;
      if (depth === 0) {
        return { start: braceStart, end: i };
      }
    }
  }
  return null; // unbalanced — treat as "guard not found"
}

function isWired(source) {
  const importsSend =
    /import\s*\{[^}]*\bsendVendorApprovalConfirmationEmail\b[^}]*\}\s*from\s*['"]@\/lib\/vendor-approval-confirmation['"]/.test(
      source,
    );
  const importsDeliver =
    /import\s*\{[^}]*\bdeliverConfirmationEmailAfterCommit\b[^}]*\}\s*from\s*['"]@\/lib\/confirmation-email['"]/.test(
      source,
    );
  if (!importsSend || !importsDeliver) return false;

  const callOccurrences = [...source.matchAll(/sendVendorApprovalConfirmationEmail\(/g)];
  if (callOccurrences.length !== 1) return false; // must be called exactly once, anywhere
  const callIndex = callOccurrences[0].index;

  const wrappedMatch = /deliverConfirmationEmailAfterCommit\(\s*\(\)\s*=>\s*sendVendorApprovalConfirmationEmail\(/.exec(
    source,
  );
  if (!wrappedMatch) return false; // the one call must be wrapped, never bare-awaited

  const guard = findApproveGuardBlock(source);
  if (!guard) return false; // no 'approve'-only guard at all
  if (callIndex < guard.start || callIndex > guard.end) return false; // call sits outside the guard

  const refUpdateMatch = /ref\.update\(\s*decision\.patch\s*\)/.exec(source);
  if (!refUpdateMatch) return false;
  if (callIndex < refUpdateMatch.index) return false; // email attempted before the write commits

  return true;
}

const wiredGoldenPath = path.join(
  REPO_ROOT,
  'contracts/golden/vendor-f8-approval-email/vendors-review-route-wired.expected.ts.txt',
);
const unwiredNoEmailPath = path.join(__dirname, 'fixtures/vendors-review-route-unwired-no-email.fixture.ts.txt');
const unwiredBothActionsPath = path.join(
  __dirname,
  'fixtures/vendors-review-route-unwired-both-actions.fixture.ts.txt',
);

const wired = readFileSync(wiredGoldenPath, 'utf8');
const unwiredNoEmail = readFileSync(unwiredNoEmailPath, 'utf8');
const unwiredBothActions = readFileSync(unwiredBothActionsPath, 'utf8');

if (!isWired(wired)) {
  failures.push(
    'SELF-TEST FAILED — the discriminator reports this contract\'s own architect-authored WIRED ' +
      'golden as unwired. The discriminator is broken and cannot be trusted against the real file.',
  );
}
if (isWired(unwiredNoEmail)) {
  failures.push(
    'SELF-TEST FAILED — the discriminator reports KNOWN-UNWIRED fixture #1 (no email call at all) ' +
      'as wired. The discriminator is broken and cannot be trusted against the real file.',
  );
}
if (isWired(unwiredBothActions)) {
  failures.push(
    'SELF-TEST FAILED — the discriminator reports KNOWN-UNWIRED fixture #2 (email call outside the ' +
      "'approve' guard) as wired. The discriminator is broken and cannot be trusted against the real file.",
  );
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} self-test(s) failed. Refusing to check the real repository file.`);
  process.exit(1);
}

const realPath = path.join(REPO_ROOT, 'app/api/admin/vendors/[id]/review/route.ts');
let realSource;
try {
  realSource = readFileSync(realPath, 'utf8');
} catch (error) {
  console.error(`FAIL: could not read ${realPath}: ${error.message}`);
  process.exit(1);
}

if (!isWired(realSource)) {
  console.error(
    `FAIL: ${realPath} does not pass the F8 approval-email wiring discriminator. Compare against ` +
      `${wiredGoldenPath} for the exact expected wiring.`,
  );
  process.exit(1);
}

console.log(
  'PASS: app/api/admin/vendors/[id]/review/route.ts imports the real ' +
    'sendVendorApprovalConfirmationEmail and deliverConfirmationEmailAfterCommit, calls the send ' +
    "exactly once, wrapped in deliverConfirmationEmailAfterCommit, lexically inside an " +
    "`if (body.action === 'approve')` block, strictly after `ref.update(decision.patch)`. Every " +
    'self-test passed (rejects both known-unwired fixtures, accepts the architect-authored wired ' +
    'golden) before the real file was checked.',
);
process.exit(0);
