// A34 — regression guard: a full run of the four Firestore-mutating payfast-m1
// behavioural checks leaves the `tickets` collection free of any genuinely new,
// unaccounted-for document.
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
// REWRITTEN (see contracts/golden/payfast-m1-lock-cleanup-fix/a34-replacement-spec.golden.md)
// The original comparator (judgeResidue) compared Firestore document COUNTS only. A run
// that leaks one new doc while an unrelated cleanup elsewhere removes one pre-existing
// doc nets to zero change and reports clean — the exact "same count, different
// documents" blind spot this rewrite closes. judgeResidueBySets() below is an
// identity-set comparator: it flags any doc ID present after the run that was neither
// present before NOR already catalogued as known residue.
// It was also blind to the timeout/lock-wait inversion (F1's fix): it spawned its four
// sub-scripts with no timeout of its own, so it never experienced the SIGKILL collision
// that skips cleanup — it relied entirely on contract.py's outer timeout, which is
// exactly the blindness this rewrite fixes by imposing its own child timeout.
//
// Three parts:
//   1. Pure self-test (always runs, no credentials, no network) of judgeResidueBySets() —
//      same "detector proves it can still discriminate" convention as
//      check-paid-write-inside-transaction-scope.mjs's judge() self-test.
//   2. Live full-suite proof (LOCAL-ONLY, same credential/skip convention as A18): reads
//      `tickets` doc IDs before, spawns the four real behavioural payfast-m1 scripts as
//      real child processes with THIS script's own imposed timeout, reads `tickets` doc
//      IDs after, and judges via judgeResidueBySets(). A child script's own PASS/FAIL is
//      irrelevant here — only identity-set membership matters.
//   3. Capability proof (LOCAL-ONLY): deliberately kills the decoy fixture (never a real
//      suite script), confirms judgeResidueBySets() DOES flag the resulting orphan (the
//      detector demonstrably CAN fail), then sweeps it via F2's
//      sweepManifestFromPriorRun() and confirms a second comparison is clean — proving F2
//      and F4 compose correctly together.
//
// This script itself never issues a Firestore delete call — cleanup stays fully
// delegated to sweepManifestFromPriorRun() / the sub-scripts' own withCleanup().

import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { credentialsAvailable, skipForMissingCredentials } from './_itn-harness.mts';
import { KNOWN_RESIDUE_DOC_IDS } from '../../../scripts/scan-firestore-residue.ts';

const ASSERTION_ID = 'A34';

const SUITE_SCRIPTS = [
  'contracts/checks/payfast-m1/check-itn-amount-tamper-rejected.mts',
  'contracts/checks/payfast-m1/check-itn-server-confirm-and-status-gating.mts',
  'contracts/checks/payfast-m1/check-itn-atomic-idempotent-write.mts',
  'contracts/checks/payfast-m1/check-itn-source-ip-validation.mts',
];

// This script must be ABLE to reproduce a kill (see the capability-proof half below),
// which requires it to own the timeout on its spawned children, not delegate to
// contract.py's outer timeout — delegating to the caller is exactly the blindness F1/F4
// exist to fix. Matches ticketing-hardening/_shared.mjs's MIN_ASSERTION_TIMEOUT_MS.
const CHILD_TIMEOUT_MS = 120_000;

const DECOY_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), '_fixtures/decoy-lock-holder.mjs');
const WRITE_COMPLETE_MARKER = 'DECOY: write completed';
const KILL_DELAY_AFTER_MARKER_MS = 200;

/**
 * Identity-set comparator: fails when `afterIds` contains any ID that is in neither
 * `beforeIds` nor `knownResidueIds` — i.e. a genuinely NEW, unaccounted-for document
 * appeared. Does not fail on a document disappearing (out of scope — could be a
 * legitimate concurrent cleanup elsewhere; flagging it would be noise unrelated to the
 * leak this check exists to catch). Returns null if clean, a descriptive problem string
 * otherwise.
 */
export function judgeResidueBySets(beforeIds, afterIds, knownResidueIds) {
  const newUnaccountedIds = [...afterIds].filter((id) => !beforeIds.has(id) && !knownResidueIds.has(id));
  if (newUnaccountedIds.length === 0) return null;
  return `${newUnaccountedIds.length} new, unaccounted-for tickets document(s) appeared after the suite run: ${newUnaccountedIds.join(', ')}`;
}

// --- comparator self-test ----------------------------------------------------
function selfTest() {
  const failures = [];
  const empty = new Set();

  if (judgeResidueBySets(new Set(['a', 'b']), new Set(['a', 'b']), empty) !== null) {
    failures.push('identical before/after sets must report clean');
  }
  if (!judgeResidueBySets(new Set(['a']), new Set(['a', 'b']), empty)) {
    failures.push('a new, unaccounted-for ID must be reported as a real leak');
  }
  // The exact blind spot the OLD count-only judgeResidue would have missed: one new
  // unaccounted ID appears AND one pre-existing ID disappears — same total count,
  // different membership.
  if (!judgeResidueBySets(new Set(['a', 'b']), new Set(['a', 'c']), empty)) {
    failures.push('same-count-different-membership (one new + one missing) must still be reported — this is the count-only comparator\'s exact blind spot');
  }
  if (judgeResidueBySets(new Set(['a']), new Set(['a', 'known']), new Set(['known'])) !== null) {
    failures.push('an extra ID that IS in knownResidueIds must not be reported as a new leak');
  }

  if (failures.length > 0) {
    console.error(`FAIL: ${ASSERTION_ID} self-test — judgeResidueBySets() can no longer discriminate`);
    for (const failure of failures) console.error(`  - ${failure}`);
    process.exit(1);
  }
  console.log(`PASS: ${ASSERTION_ID} self-test — judgeResidueBySets() discriminates clean vs. leaked identity sets, including the same-count-different-membership case`);
}

if (process.argv.includes('--self-test-only')) {
  selfTest();
  process.exit(0);
}

selfTest();

if (!credentialsAvailable()) skipForMissingCredentials(ASSERTION_ID);

const shared = await import('../ticketing-hardening/_shared.mjs');

/** Spawn one payfast-m1 behavioural check as a real child process, with THIS script's
 * own imposed timeout (setTimeout + kill) rather than relying on contract.py's outer
 * timeout. Its exit code is logged but never treated as this script's own failure — see
 * header comment. */
function runSuiteScript(scriptPath) {
  return new Promise((resolve) => {
    const child = spawn('pnpm', ['exec', 'tsx', scriptPath], { stdio: 'inherit', detached: true });
    const killTimer = setTimeout(() => {
      console.error(`${ASSERTION_ID}: ${scriptPath} exceeded its ${CHILD_TIMEOUT_MS / 1000}s imposed timeout — killing`);
      try {
        process.kill(-child.pid, 'SIGKILL');
      } catch {
        // already gone
      }
    }, CHILD_TIMEOUT_MS);
    child.on('close', (code) => {
      clearTimeout(killTimer);
      resolve({ scriptPath, code });
    });
  });
}

async function readAllTicketIds() {
  const snap = await shared.db().collection(shared.TICKETS_COLLECTION).get();
  return new Set(snap.docs.map((doc) => doc.id));
}

/** Spawns the decoy fixture, waits for its write-complete marker, then SIGKILLs its
 * whole process group (see check-manifest-survives-kill.mjs's header comment on why
 * `pnpm exec tsx`'s nested child requires a process-group kill, not a direct signal). */
function spawnAndKillDecoy(runId) {
  return new Promise((resolve, reject) => {
    const child = spawn('pnpm', ['exec', 'tsx', DECOY_PATH], {
      env: { ...process.env, DECOY_RUN_ID: runId },
      detached: true,
    });
    let stdout = '';
    let killed = false;
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
      if (!killed && stdout.includes(WRITE_COMPLETE_MARKER)) {
        killed = true;
        setTimeout(() => {
          try {
            process.kill(-child.pid, 'SIGKILL');
          } catch {
            // already gone
          }
        }, KILL_DELAY_AFTER_MARKER_MS);
      }
    });
    child.on('error', reject);
    child.on('close', () => resolve(stdout));
  });
}

// --- Part 2: normal full-suite run -------------------------------------------
const beforeIds = await readAllTicketIds();
console.log(`${ASSERTION_ID}: tickets doc count before suite run = ${beforeIds.size}`);

for (const scriptPath of SUITE_SCRIPTS) {
  const { code } = await runSuiteScript(scriptPath);
  console.log(`${ASSERTION_ID}: ${scriptPath} exited ${code} (informational — not judged here)`);
}

const afterIds = await readAllTicketIds();
console.log(`${ASSERTION_ID}: tickets doc count after suite run = ${afterIds.size}`);

const suiteRunProblem = judgeResidueBySets(beforeIds, afterIds, KNOWN_RESIDUE_DOC_IDS);
if (suiteRunProblem) {
  console.error(`FAIL: ${ASSERTION_ID} (full-suite run) ${suiteRunProblem}`);
  process.exit(1);
}
console.log(`PASS: ${ASSERTION_ID} (full-suite run) no new, unaccounted-for tickets documents after the full suite run`);

// --- Part 3: capability proof — deliberate kill against the decoy ------------
const runId = randomBytes(4).toString('hex');
const decoyBookingRef = `DECOY-A34-${runId}`;
console.log(`${ASSERTION_ID}: capability proof — spawning decoy fixture (bookingRef ${decoyBookingRef})`);

const beforeDecoyIds = await readAllTicketIds();
await spawnAndKillDecoy(runId);
const afterDecoyIds = await readAllTicketIds();

const decoyProblem = judgeResidueBySets(beforeDecoyIds, afterDecoyIds, KNOWN_RESIDUE_DOC_IDS);
if (!decoyProblem) {
  console.error(
    `FAIL: ${ASSERTION_ID} capability proof — judgeResidueBySets() did NOT flag the decoy's orphaned document. A detector that cannot observe the failure it exists to catch is worse than no detector.`
  );
  process.exit(1);
}
console.log(`${ASSERTION_ID}: capability proof — judgeResidueBySets() correctly flagged the orphan: ${decoyProblem}`);

const sweptCount = await shared.sweepManifestFromPriorRun();
if (sweptCount < 1) {
  console.error(`FAIL: ${ASSERTION_ID} capability proof — expected sweepManifestFromPriorRun() to sweep at least 1 entry, got ${sweptCount}`);
  process.exit(1);
}

const afterSweepIds = await readAllTicketIds();
const postSweepProblem = judgeResidueBySets(beforeDecoyIds, afterSweepIds, KNOWN_RESIDUE_DOC_IDS);
if (postSweepProblem) {
  console.error(`FAIL: ${ASSERTION_ID} capability proof — still residue after sweepManifestFromPriorRun(): ${postSweepProblem}`);
  process.exit(1);
}
console.log(`PASS: ${ASSERTION_ID} capability proof — F2's sweepManifestFromPriorRun() removed the orphan and a second comparison is clean (F2 and F4 compose correctly)`);
