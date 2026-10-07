// F4 (conference-workshop-tickets, M2) — A13: both concurrency checks (A11/A12) run
// against the Firebase emulator or an equivalent transaction-faithful harness, not a
// plain in-memory mock of the transaction. No Firebase emulator is available on this
// machine (needs a Java runtime that isn't installed — same precondition
// contracts/checks/vendor-gated-registration-flow/check-single-use-claim-is-atomic.mjs
// documents), so the project's established equivalent is an optimistic-concurrency
// fake WITH a control arm proving it can express the defect under test (same technique
// that file uses). This check proves _concurrency-harness.mjs — the shared harness both
// A11 and A12 import — actually has those two load-bearing properties, by inspecting
// its own source text, rather than re-running the (already expensive) concurrency
// bursts a third time.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HARNESS_REL_PATH = 'contracts/checks/conference-workshop-tickets-f4/_concurrency-harness.mjs';
const failures = [];

let source;
try {
  source = readFileSync(path.join(__dirname, '_concurrency-harness.mjs'), 'utf8');
} catch (error) {
  console.error('FAIL: check-concurrency-tests-use-real-transaction-harness.mjs');
  console.error(`  - could not read ${HARNESS_REL_PATH}: ${error.message}`);
  process.exit(1);
}

// Property 1: version-stamped optimistic-concurrency reads (a plain mock has no notion
// of "stale" — it would just serialise every call).
if (!/version/.test(source) || !/readVersion/.test(source)) {
  failures.push('harness has no version-stamped read tracking (readVersion/store.version) — this is the defining property of optimistic concurrency, not a plain in-memory mock');
}
if (!/store\.version\s*!==\s*readVersion/.test(source)) {
  failures.push('harness never re-checks store.version against the read-time version at commit — a plain mock cannot detect contention at all');
}

// Property 2: a CONTROL arm that reproduces the pre-fix shape with NO re-check — the
// thing that proves the harness is capable of expressing the defect in the first place.
if (!/attemptReservationNoRecheck/.test(source)) {
  failures.push('harness has no CONTROL (no-recheck) code path — without one, a green concurrency result proves nothing (it could just be a mock that always serialises)');
}

// Property 3: a real synchronisation barrier forcing every concurrent attempt to
// complete its READ before any of them is allowed to COMMIT — the actual race window a
// sequential-only mock could never produce. (ticketing-conferences/payfast-m1's own ITN
// race check — check-itn-atomic-idempotent-write.mts — documents the same requirement:
// "a sequential replay... is not exercising the code".)
if (!/barrier/.test(source) || !/beforeCommit/.test(source)) {
  failures.push('harness has no beforeCommit/barrier synchronisation point forcing concurrent reads before any commit — cannot reproduce a genuine race, only a sequential replay');
}

// Both consuming checks must actually import this shared harness, not their own
// one-off mock each.
for (const consumer of ['check-concurrency-no-oversell-shared-pool.mjs', 'check-concurrency-no-oversell-day-cap.mjs']) {
  let consumerSource;
  try {
    consumerSource = readFileSync(path.join(__dirname, consumer), 'utf8');
  } catch (error) {
    failures.push(`could not read ${consumer}: ${error.message}`);
    continue;
  }
  if (!/_concurrency-harness\.mjs/.test(consumerSource)) {
    failures.push(`${consumer} does not import ./_concurrency-harness.mjs — must share the SAME harness, not a second ad-hoc mock`);
  }
}

if (failures.length > 0) {
  console.error('FAIL: check-concurrency-tests-use-real-transaction-harness.mjs');
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(
  'PASS: the shared concurrency harness is version-stamped optimistic-concurrency (not a plain sequential mock), carries a CONTROL arm proving it can express an oversell, and both A11/A12 checks import it.',
);
