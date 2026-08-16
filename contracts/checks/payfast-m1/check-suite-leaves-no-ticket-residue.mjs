// A34 — regression guard: a full run of the four Firestore-mutating payfast-m1
// behavioural checks leaves the `tickets` collection document count unchanged.
//
// WHY THIS EXISTS
// Every Firestore-mutating check under contracts/checks/payfast-m1/ already routes its
// fixture writes through contracts/checks/ticketing-hardening/_shared.mjs's
// withCleanup(), which sweeps every doc carrying the sentinel domain in a `finally`
// block and polls assertNoResidue() afterwards. This script is NOT a first-time cleanup
// fix — it is a regression guard: if a future check is added without withCleanup(), or
// an existing one is edited to bypass it, this catches the leak the same day instead of
// someone finding strays in the live database a month later (see
// contracts/golden/payfast-m1-residue-cleanup/leaked-docs-2026-08-16.md for exactly that
// incident).
//
// Two independent halves:
//   1. Pure self-test (always runs, no credentials, no network) of judgeResidue(before,
//      after) — same "detector proves it can still discriminate" convention as
//      check-paid-write-inside-transaction-scope.mjs's judge() self-test. If this fails,
//      the comparison logic itself is broken and nothing downstream can be trusted.
//   2. Live full-suite proof (LOCAL-ONLY, same credential/skip convention as A18/A30 —
//      see _itn-harness.mts's credentialsAvailable()/skipForMissingCredentials()): counts
//      `tickets` via db.collection('tickets').count().get() before and after running the
//      four behavioural payfast-m1 checks as real child processes (`pnpm exec tsx
//      <file>`, one per script), then judges the before/after counts. A child script's
//      own PASS/FAIL is irrelevant here — only the count delta matters, because a script
//      can fail its own assertion for reasons unrelated to cleanup while its
//      withCleanup() `finally` block still ran correctly.
//
// This script itself never issues a Firestore delete call — cleanup stays fully
// delegated to the sub-scripts' own withCleanup(). It only counts.

import { spawn } from 'node:child_process';

import { credentialsAvailable, skipForMissingCredentials } from './_itn-harness.mts';

const ASSERTION_ID = 'A34';

const SUITE_SCRIPTS = [
  'contracts/checks/payfast-m1/check-itn-amount-tamper-rejected.mts',
  'contracts/checks/payfast-m1/check-itn-server-confirm-and-status-gating.mts',
  'contracts/checks/payfast-m1/check-itn-atomic-idempotent-write.mts',
  'contracts/checks/payfast-m1/check-itn-source-ip-validation.mts',
];

/**
 * Pure comparator: returns null when the tickets count is unchanged, a descriptive
 * problem string otherwise. No I/O, no Firestore, no process — deliberately kept trivial
 * so its own correctness can be proven by inline self-test before anything live runs.
 */
export function judgeResidue(before, after) {
  if (before === after) return null;
  const delta = after - before;
  const direction = delta > 0 ? 'grew' : 'shrank';
  return `tickets collection ${direction} by ${Math.abs(delta)} document(s) (${before} -> ${after}) — residue left behind by the suite run`;
}

// --- comparator self-test ----------------------------------------------------
const selfTestFailures = [];
if (judgeResidue(5, 5) !== null) {
  selfTestFailures.push('judgeResidue(5, 5) must be null (no change must report clean)');
}
if (!judgeResidue(5, 12)) {
  selfTestFailures.push('judgeResidue(5, 12) must be truthy (a real leak must be reported)');
}
if (!judgeResidue(12, 5)) {
  selfTestFailures.push('judgeResidue(12, 5) must be truthy (a shrink must also be reported)');
}
if (selfTestFailures.length > 0) {
  console.error(`FAIL: ${ASSERTION_ID} self-test — judgeResidue() can no longer discriminate`);
  for (const failure of selfTestFailures) console.error(`  - ${failure}`);
  process.exit(1);
}
console.log(`PASS: ${ASSERTION_ID} self-test — judgeResidue() discriminates clean vs. leaked counts`);

if (!credentialsAvailable()) skipForMissingCredentials(ASSERTION_ID);

/** Spawn one payfast-m1 behavioural check as a real child process. Its exit code is
 * logged but never treated as this script's own failure — see header comment. */
function runSuiteScript(scriptPath) {
  return new Promise((resolve) => {
    const child = spawn('pnpm', ['exec', 'tsx', scriptPath], { stdio: 'inherit' });
    child.on('close', (code) => resolve({ scriptPath, code }));
  });
}

async function countTickets() {
  const { initializeApp, getApps, cert } = await import('firebase-admin/app');
  const { getFirestore } = await import('firebase-admin/firestore');
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n');
  const app =
    getApps().find((existing) => existing.name === 'payfast-m1-residue-guard') ??
    initializeApp(
      { credential: cert({ projectId, clientEmail, privateKey }) },
      'payfast-m1-residue-guard',
    );
  const db = getFirestore(app);
  const snapshot = await db.collection('tickets').count().get();
  return snapshot.data().count;
}

const before = await countTickets();
console.log(`${ASSERTION_ID}: tickets count before suite run = ${before}`);

for (const scriptPath of SUITE_SCRIPTS) {
  const { code } = await runSuiteScript(scriptPath);
  console.log(`${ASSERTION_ID}: ${scriptPath} exited ${code} (informational — not judged here)`);
}

const after = await countTickets();
console.log(`${ASSERTION_ID}: tickets count after suite run = ${after}`);

const problem = judgeResidue(before, after);
if (problem) {
  console.error(`FAIL: ${ASSERTION_ID} ${problem}`);
  process.exit(1);
}
console.log(`PASS: ${ASSERTION_ID} tickets count unchanged (${before} -> ${after}) after the full suite run`);
